import { getVideoIdFromUrl, isYouTubeWatchPage, waitForVideoElement, onYouTubeNavigation } from './youtube';
import { loadProfile, saveProfile } from './storage';
import { LoopController } from './loops';
import { CountIn } from './audio/countin';
import { UIController } from './ui-controller';
import { isInputElement, clamp, throttle, barsToSeconds } from '../utils';
import { VideoProfile, LoopSegment } from '../types';

export class YouTubeLoopPractice {
  private video?: HTMLVideoElement;
  private videoId?: string;
  private profile?: VideoProfile;
  private loopController?: LoopController;
  private countIn = new CountIn();
  private uiController?: UIController;
  public isInitialized = false;
  private saveProfileThrottled: () => void;
  private navigationListenerRegistered = false;

  constructor() {
    this.saveProfileThrottled = throttle(() => this.saveProfile(), 1000);
    
    // 즉시 메시지 리스너 등록 (초기화 전에도 응답 가능하도록)
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
    console.log('Content Script 메시지 리스너 등록 완료');
  }

  async init() {
    try {
      console.log('YouTubeLoopPractice 초기화 시작');

      // YouTube watch 페이지인지 확인
      if (!isYouTubeWatchPage()) {
        console.log('YouTube watch 페이지가 아님, 초기화 건너뜀');
        return;
      }

      console.log('YouTube watch 페이지 확인됨');

      // 비디오 요소 대기
      this.video = await waitForVideoElement();
      if (!this.video) {
        console.log('비디오 요소를 찾을 수 없음');
        return;
      }

      console.log('비디오 요소 발견:', this.video);

      // 비디오 ID 추출
      const videoId = getVideoIdFromUrl();
      if (!videoId) {
        console.log('비디오 ID를 추출할 수 없음');
        return;
      }

      // 이미 같은 영상에 대해 초기화되어 있으면 건너뜀
      if (this.isInitialized && this.videoId === videoId) {
        console.log('이미 동일 영상에 대해 초기화됨, 초기화 건너뜀');
        return;
      }

      // 다른 영상으로 전환된 경우 기존 상태 정리
      if (this.isInitialized && this.videoId !== videoId) {
        console.log('다른 영상으로 전환 감지, 기존 상태 정리');
        this.cleanup();

        // cleanup 후 비디오 요소 다시 가져오기
        this.video = await waitForVideoElement();
        if (!this.video) {
          console.log('cleanup 후 비디오 요소를 찾을 수 없음');
          return;
        }
      }

      this.videoId = videoId;
      console.log('비디오 ID:', videoId);

      // 프로필 로드
      this.profile = await loadProfile(this.videoId);
      // 페이지 로드/새로고침 시 활성 루프 초기화
      this.profile.activeSegmentId = null;
      console.log('프로필 로드 완료 (활성 루프 초기화됨):', this.profile);

      // 영상 제목과 채널 이름 가져오기
      await this.fetchVideoMetadata();

      // 루프 컨트롤러 초기화
      this.loopController = new LoopController(this.video, this.profile);
      console.log('루프 컨트롤러 초기화 완료');

      // UI 컨트롤러 초기화
      this.uiController = new UIController();
      await this.uiController.init(this.profile, this.handleUICommand.bind(this));
      console.log('UI 컨트롤러 초기화 완료');

      // 이벤트 리스너 설정
      this.setupEventListeners();
      console.log('이벤트 리스너 설정 완료');

      // YouTube 네비게이션 감지 (한 번만 등록)
      if (!this.navigationListenerRegistered) {
        this.navigationListenerRegistered = true;
        onYouTubeNavigation(() => {
          console.log('YouTube 네비게이션 감지, 재초기화 시도');
          setTimeout(() => this.init(), 500);
        });
      }

      this.isInitialized = true;
      console.log('Loop Practice for YouTube 초기화 완료');

    } catch (error) {
      console.error('초기화 실패:', error);
    }
  }

  private setupEventListeners() {
    if (!this.video || !this.loopController) {
      console.log('setupEventListeners: video 또는 loopController가 없음', {
        video: !!this.video,
        loopController: !!this.loopController
      });
      return;
    }

    console.log('이벤트 리스너 설정 시작');

    // 비디오 timeupdate 이벤트
    const timeUpdateHandler = () => {
      this.loopController?.onTimeUpdate();
    };

    this.video.addEventListener('timeupdate', timeUpdateHandler);
    console.log('timeupdate 이벤트 리스너 등록 완료');

    // 키보드 이벤트
    window.addEventListener('keydown', this.handleKeydown.bind(this));
    
    console.log('모든 이벤트 리스너 설정 완료');
  }

  private handleKeydown(e: KeyboardEvent) {
    // 입력 요소에 포커스가 있으면 무시
    if (isInputElement(e.target as HTMLElement)) return;

    const key = e.key.toLowerCase();

    switch (key) {
      case ' ':
        e.preventDefault();
        this.togglePlay();
        break;
      case 'l':
        e.preventDefault();
        this.toggleLoop();
        break;
      case '[':
        e.preventDefault();
        this.gotoSegment(-1);
        break;
      case ']':
        e.preventDefault();
        this.gotoSegment(1);
        break;
      case '-':
      case '_':
        e.preventDefault();
        this.changeRate(-0.05);
        break;
      case '=':
      case '+':
        e.preventDefault();
        this.changeRate(0.05);
        break;
      case 'c':
        e.preventDefault();
        this.runCountIn();
        break;
    }
  }

  /**
   * UI에서 발생한 명령을 처리합니다.
   */
  private async handleUICommand(command: string, data?: any) {
    try {
      switch (command) {
        case 'create-segment':
          // duration이 "bar:N" 형식인지 확인
          let duration: number | undefined;
          const durationValue = data?.duration;

          if (typeof durationValue === 'string' && durationValue.startsWith('bar:')) {
            const bars = parseInt(durationValue.split(':')[1], 10);
            if (!isNaN(bars) && this.profile) {
              const bpm = this.profile.tempo || 120;
              const timeSignature = this.profile.timeSignature || '4/4';
              duration = barsToSeconds(bars, bpm, timeSignature);
            }
          } else if (typeof durationValue === 'number') {
            duration = durationValue;
          } else if (typeof durationValue === 'string') {
            duration = parseInt(durationValue, 10);
          }

          this.createSegmentFromUI(data?.label || '', duration);
          this.refreshUI();
          break;
        case 'set-segment-end':
          this.setSegmentEnd();
          this.refreshUI();
          break;
        case 'jump-and-activate':
          await this.jumpAndActivateSegment(data?.segmentId);
          this.refreshUI();
          break;
        case 'delete-segment':
          this.deleteSegment(data?.segmentId);
          this.refreshUI();
          break;
        case 'duplicate-segment':
          this.duplicateSegment(data?.segmentId);
          this.refreshUI();
          break;
        case 'update-label':
          this.updateSegment(data?.segmentId, { label: data?.label });
          this.refreshUI();
          break;
        case 'set-start-time':
          await this.setSegmentStartTime(data?.segmentId);
          this.refreshUI();
          break;
        case 'set-end-time':
          await this.setSegmentEndTime(data?.segmentId);
          this.refreshUI();
          break;
        case 'update-time':
          console.log('[update-time] 호출됨:', { timeType: data?.timeType, time: data?.time, segmentId: data?.segmentId });

          const timeUpdate = data?.timeType === 'start'
            ? { start: data?.time }
            : { end: data?.time };
          this.updateSegment(data?.segmentId, timeUpdate);

          // 드래그 중 실시간 피드백: Start time 변경 시에만 영상 위치를 이동
          // End time 변경 시에는 현재 재생 위치를 유지
          if (data?.timeType === 'start' && this.video && typeof data?.time === 'number' && !isNaN(data.time)) {
            console.log('[update-time] Start time 변경 → 재생 위치 이동:', data.time);
            this.video.currentTime = data.time;
          } else {
            console.log('[update-time] End time 변경 → 재생 위치 유지');
          }

          this.refreshUI();
          break;
        case 'decrease-rate':
          this.decreaseSegmentRate(data?.segmentId);
          this.refreshUI();
          break;
        case 'increase-rate':
          this.increaseSegmentRate(data?.segmentId);
          this.refreshUI();
          break;
        case 'update-rate':
          this.updateSegment(data?.segmentId, { rate: data?.rate });
          this.refreshUI();
          break;
        case 'update-tempo':
          this.updateProfile(profile => {
            profile.tempo = data?.tempo;
          });
          this.refreshUI();
          break;
        case 'update-time-signature':
          this.updateProfile(profile => {
            profile.timeSignature = data?.timeSignature;
          });
          this.refreshUI();
          break;
        case 'toggle-metronome':
          this.toggleMetronome(data?.segmentId);
          this.refreshUI();
          break;
        case 'update-global-sync-realtime':
          // 드래그 중 실시간 업데이트 (저장하지 않음)
          this.updateProfile(profile => {
            profile.globalMetronomeOffset = data?.offset;
          });
          // 메트로놈 재시작으로 새 오프셋 적용
          if (this.loopController && this.loopController.getActive()) {
            const active = this.loopController.getActive();
            if (active?.metronomeEnabled && !this.video?.paused) {
              this.loopController.toggleMetronome(active.id); // off
              this.loopController.toggleMetronome(active.id); // on
            }
          }
          break;
        case 'update-global-sync':
          this.updateProfile(profile => {
            profile.globalMetronomeOffset = data?.offset;
          });
          this.saveProfile();
          // 실시간으로 메트로놈에 반영 (재생 중인 경우)
          if (this.loopController && this.loopController.getActive()) {
            const active = this.loopController.getActive();
            if (active?.metronomeEnabled && !this.video?.paused) {
              // 메트로놈 재시작으로 새 오프셋 적용
              this.loopController.toggleMetronome(active.id); // off
              this.loopController.toggleMetronome(active.id); // on
            }
          }
          break;
        case 'apply-global-sync':
          this.applyGlobalSyncToAllLoops(data?.offset);
          this.refreshUI();
          break;
        case 'toggle-global-sync-metronome':
          this.toggleGlobalSyncMetronome(data?.enabled);
          break;
        case 'reorder-segments':
          // segments 배열이 직접 전달된 경우 (UI에서 이미 재정렬됨)
          if (data?.segments) {
            this.updateProfile(profile => {
              profile.segments = data.segments;
            });
            this.saveProfile();
          } else {
            // 기존 방식: draggedId와 targetId로 재정렬
            this.reorderSegments(data?.draggedId, data?.targetId);
          }
          this.refreshUI();
          break;
        case 'add-8-bars':
          this.add8BarsAfterSegment(data?.segmentId);
          this.refreshUI();
          break;
        default:
          console.warn('Unknown UI command:', command);
      }
    } catch (error) {
      console.error('Error handling UI command:', error);
    }
  }

  /**
   * UI를 새로고침합니다.
   */
  private refreshUI() {
    if (this.uiController && this.profile) {
      this.uiController.updateProfile(this.profile);
    }
  }

  /**
   * YouTube 영상의 제목과 채널 이름을 가져와서 프로필에 저장합니다.
   */
  private async fetchVideoMetadata() {
    if (!this.profile) return;

    try {
      // 영상 제목 가져오기 (최대 50번 시도, 100ms 간격)
      let videoTitle = '';
      for (let i = 0; i < 50; i++) {
        const titleElement = document.querySelector('h1.ytd-watch-metadata yt-formatted-string');
        if (titleElement?.textContent) {
          videoTitle = titleElement.textContent.trim();
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // 채널 이름 가져오기
      let channelName = '';
      for (let i = 0; i < 50; i++) {
        const channelElement = document.querySelector('ytd-channel-name#channel-name yt-formatted-string a');
        if (channelElement?.textContent) {
          channelName = channelElement.textContent.trim();
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // 프로필에 저장 (변경된 경우만)
      let updated = false;
      if (videoTitle && this.profile.videoTitle !== videoTitle) {
        this.profile.videoTitle = videoTitle;
        updated = true;
      }
      if (channelName && this.profile.channelName !== channelName) {
        this.profile.channelName = channelName;
        updated = true;
      }

      if (updated) {
        await this.saveProfile();
        console.log('영상 메타데이터 저장:', { videoTitle, channelName });
      }
    } catch (error) {
      console.error('영상 메타데이터 가져오기 실패:', error);
    }
  }

  private handleMessage(message: any, _sender: any, sendResponse: any) {
    try {
      console.log('Content Script message received:', message);
      
      // Messages that can be responded to even when not initialized
      if (message?.type === 'PING') {
        console.log('PING message received, sending response');
        sendResponse({ status: 'ok', timestamp: Date.now(), initialized: this.isInitialized });
        return true;
      }
      
      if (message?.type === 'GET_CURRENT_TIME') {
        const currentTime = this.video?.currentTime || 0;
        console.log('Current time request:', currentTime);
        sendResponse({ currentTime });
        return true;
      }
      
      if (message?.type === 'JUMP_TO_TIME') {
        if (this.video && typeof message.time === 'number') {
          this.video.currentTime = message.time;
          console.log('Jumped to time:', message.time);
          sendResponse({ success: true });
        } else {
          sendResponse({ error: 'Invalid time or video not available' });
        }
        return true;
      }
      
      // For other messages, error response if not initialized
      if (!this.isInitialized) {
        console.log('Content Script not initialized, ignoring message:', message?.type);
        sendResponse({ error: 'Content script not initialized' });
        return true;
      }
      
      if (message?.type === 'COMMAND') {
        switch (message.command) {
          case 'toggle-play':
            this.togglePlay();
            break;
          case 'toggle-loop':
            this.toggleLoop();
            break;
          case 'prev-segment':
            this.gotoSegment(-1);
            break;
          case 'next-segment':
            this.gotoSegment(1);
            break;
          case 'decrease-speed':
            this.changeRate(-0.05);
            break;
          case 'increase-speed':
            this.changeRate(0.05);
            break;
          case 'count-in':
            this.runCountIn();
            break;
          case 'set-segment-end':
            this.setSegmentEnd();
            break;
        }
        sendResponse({ success: true });
      } else if (message?.type === 'CREATE_SEGMENT') {
        const result = this.createSegmentWithTime(message.label, message.startTime, message.endTime);
        sendResponse({ success: !!result, segment: result });
      } else if (message?.type === 'ACTIVATE_SEGMENT') {
        this.activateSegment(message.segmentId);
        sendResponse({ success: true });
      } else if (message?.type === 'DELETE_SEGMENT') {
        const success = this.deleteSegment(message.segmentId);
        sendResponse({ success });
      } else if (message?.type === 'UPDATE_SEGMENT') {
        // Extract only necessary fields to pass
        const updates: any = {};
        if (message.label !== undefined) updates.label = message.label;
        if (message.start !== undefined) updates.start = message.start;
        if (message.end !== undefined) updates.end = message.end;
        if (message.rate !== undefined) updates.rate = message.rate;
        
        const success = this.updateSegment(message.segmentId, updates);
        sendResponse({ success });
      } else if (message?.type === 'GET_STATE') {
        sendResponse({ profile: this.profile });
      } else {
        console.log('Unknown message type:', message?.type);
        sendResponse({ error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Error processing message:', error);
      sendResponse({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
    
    // Return true for async response
    return true;
  }

  private togglePlay() {
    if (!this.video) return;
    
    if (this.video.paused) {
      this.video.play().catch(() => {
        // 재생 실패 시 무시 (광고 등)
      });
    } else {
      this.video.pause();
    }
  }

  private toggleLoop() {
    console.log('toggleLoop 호출됨');

    if (!this.profile || !this.loopController) {
      console.log('toggleLoop: profile 또는 loopController가 없음', {
        profile: !!this.profile,
        loopController: !!this.loopController
      });
      return;
    }

    const activeSegment = this.profile.segments.find(s => s.id === this.profile!.activeSegmentId);
    console.log('toggleLoop: 현재 활성 구간', activeSegment);

    if (activeSegment) {
      // 활성 구간이 있으면 비활성화
      console.log('toggleLoop: 활성 구간 비활성화');
      this.updateProfile(profile => {
        profile.activeSegmentId = null;
      });
    } else {
      // 현재 시간에 해당하는 구간을 활성화
      const currentTime = this.video?.currentTime;
      console.log('toggleLoop: 현재 시간', currentTime);

      // currentTime이 유효하지 않은 경우 처리 (더 엄격한 검사)
      if (currentTime === undefined || currentTime === null || isNaN(currentTime) || typeof currentTime !== 'number') {
        console.log('toggleLoop: currentTime이 유효하지 않음', currentTime);
        return;
      }

      const segmentAtTime = this.profile.segments.find(s =>
        currentTime >= s.start && currentTime <= s.end
      );
      console.log('toggleLoop: 현재 시간에 해당하는 구간', segmentAtTime);

      if (segmentAtTime) {
        console.log('toggleLoop: 구간 활성화', segmentAtTime.label);
        this.updateProfile(profile => {
          profile.activeSegmentId = segmentAtTime.id;
        });
      } else {
        console.log('toggleLoop: 현재 시간에 해당하는 구간이 없음');
      }
    }
  }

  private toggleMetronome(segmentId?: string) {
    console.log('toggleMetronome 호출됨:', { segmentId });

    if (!this.loopController || !segmentId) {
      console.log('toggleMetronome: loopController가 없거나 segmentId가 없음');
      return;
    }

    const isEnabled = this.loopController.toggleMetronome(segmentId);
    console.log('메트로놈 상태:', isEnabled ? '활성화' : '비활성화');

    // UI 상태 업데이트
    if (this.uiController) {
      this.uiController.setMetronomeActive(isEnabled ? segmentId : null);
    }
  }

  private reorderSegments(draggedId: string, targetId: string) {
    if (!this.profile || !draggedId || !targetId) {
      return;
    }

    const draggedIndex = this.profile.segments.findIndex(s => s.id === draggedId);
    const targetIndex = this.profile.segments.findIndex(s => s.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) {
      return;
    }

    // 배열에서 드래그된 항목 제거
    const [draggedSegment] = this.profile.segments.splice(draggedIndex, 1);

    // 새로운 위치에 삽입
    this.profile.segments.splice(targetIndex, 0, draggedSegment);

    // 프로필 저장
    this.saveProfileThrottled();

    console.log('세그먼트 순서 변경:', { draggedId, targetId, newOrder: this.profile.segments.map(s => s.id) });
  }

  /**
   * 글로벌 싱크를 모든 루프에 적용합니다.
   * 각 루프의 시작 시간을 기준으로 해당 루프의 첫 박 위치를 계산하여 저장합니다.
   */
  private applyGlobalSyncToAllLoops(globalOffset: number) {
    if (!this.profile || !this.profile.tempo || !this.profile.timeSignature) {
      return;
    }

    // 글로벌 오프셋 저장
    this.updateProfile(profile => {
      profile.globalMetronomeOffset = globalOffset;
    });

    // 현재는 루프별 개별 싱크 기능이 비활성화되어 있으므로
    // 여기서는 글로벌 오프셋만 저장하고 프로필 저장
    this.saveProfile();

    console.log('글로벌 싱크 적용:', { globalOffset, segmentsCount: this.profile.segments.length });
  }

  /**
   * 글로벌 싱크 메트로놈을 토글합니다.
   * 메트로놈이 활성화되면 모든 루프를 비활성화하고 일반 YouTube 재생 상태로 전환합니다.
   */
  private toggleGlobalSyncMetronome(enabled: boolean) {
    if (!this.loopController || !this.profile?.tempo || !this.profile?.timeSignature) {
      return;
    }

    console.log('[Global Sync Metronome] Toggle:', { enabled, video: this.video?.currentTime });

    if (enabled) {
      // 메트로놈 활성화: 모든 루프 비활성화
      const wasActive = this.loopController.getActive();
      if (wasActive) {
        console.log('[Global Sync Metronome] Disabling active loop:', wasActive.id);
        this.loopController.setActive(null);
      }

      // 글로벌 싱크 메트로놈 시작 (루프 없이)
      if (this.video && !this.video.paused) {
        this.loopController.startGlobalSyncMetronome();
      }
    } else {
      // 메트로놈 비활성화
      console.log('[Global Sync Metronome] Stopping metronome');
      this.loopController.stopGlobalSyncMetronome();
    }
  }

  private gotoSegment(dir: -1 | 1) {
    if (!this.loopController) return;
    this.loopController.gotoPrevNext(dir);
  }

  private changeRate(delta: number) {
    if (!this.profile) return;
    
    // 안전한 defaultRate 계산
    const safeDefaultRate = typeof this.profile.defaultRate === 'number' && !isNaN(this.profile.defaultRate) 
      ? this.profile.defaultRate 
      : 1.0;
    
    const newRate = clamp(safeDefaultRate + delta, 0.25, 2.0);
    this.updateProfile(profile => {
      profile.defaultRate = newRate;
    });
  }

  private runCountIn() {
    if (!this.video || !this.loopController) {
      console.log('비디오 또는 루프 컨트롤러가 없습니다.');
      return;
    }

    const activeSegment = this.loopController.getActive();
    if (!activeSegment) {
      console.log('활성 구간이 없습니다.');
      return;
    }

    // 기본 BPM 120으로 카운트인 실행
    this.countIn.run({
      beats: 4,
      bpm: 120,
      onComplete: () => {
        if (this.video && typeof activeSegment.start === 'number' && !isNaN(activeSegment.start)) {
          this.video.currentTime = activeSegment.start;
          this.video.play().catch(() => {});
        } else {
          console.log('runCountIn: activeSegment.start이 유효하지 않음', activeSegment.start);
        }
      }
    });
  }



  private createSegmentFromUI(label: string, duration?: number) {
    if (!this.video || !this.profile) return;

    const currentTime = this.video.currentTime;

    // currentTime이 유효하지 않은 경우 처리
    if (currentTime === undefined || currentTime === null || isNaN(currentTime) || typeof currentTime !== 'number') {
      console.log('createSegmentFromUI: currentTime이 유효하지 않음', currentTime);
      return;
    }

    // duration이 제공되지 않으면 기본값 10초 사용
    const effectiveDuration = duration && !isNaN(duration) ? duration : 10;
    const endTime = Math.min(currentTime + effectiveDuration, this.video.duration);

    return this.createSegmentWithTime(label, currentTime, endTime);
  }

  private createSegmentWithTime(label: string, startTime?: number, endTime?: number) {
    if (!this.video || !this.profile) return;

    // Use current time if startTime is not provided
    let finalStartTime = startTime;
    if (finalStartTime === undefined || finalStartTime === null || isNaN(finalStartTime) || typeof finalStartTime !== 'number') {
      finalStartTime = this.video.currentTime;

      if (finalStartTime === undefined || finalStartTime === null || isNaN(finalStartTime) || typeof finalStartTime !== 'number') {
        console.log('createSegmentWithTime: startTime이 유효하지 않음', finalStartTime);
        return;
      }
    }

    // Use provided endTime or default to startTime + 10 seconds
    let finalEndTime = endTime;
    if (finalEndTime === undefined || finalEndTime === null || isNaN(finalEndTime) || typeof finalEndTime !== 'number') {
      finalEndTime = Math.min(finalStartTime + 10, this.video.duration);
    }

    // 안전한 defaultRate 계산
    const safeDefaultRate = typeof this.profile.defaultRate === 'number' && !isNaN(this.profile.defaultRate)
      ? this.profile.defaultRate
      : 1.0;

    // 라벨이 비어있으면 시작 시간 ~ 끝 시간을 기준으로 자동 지정 (mm:ss 형식)
    let finalLabel = label;
    if (!finalLabel) {
      const startMins = Math.floor(finalStartTime / 60);
      const startSecs = Math.floor(finalStartTime % 60);
      const endMins = Math.floor(finalEndTime / 60);
      const endSecs = Math.floor(finalEndTime % 60);
      finalLabel = `${startMins.toString().padStart(2, '0')}:${startSecs.toString().padStart(2, '0')}~${endMins.toString().padStart(2, '0')}:${endSecs.toString().padStart(2, '0')}`;
    }

    const newSegment: LoopSegment = {
      id: Math.random().toString(36).substring(2, 15),
      start: finalStartTime,
      end: finalEndTime,
      rate: safeDefaultRate,
      label: finalLabel
    };

    this.updateProfile(profile => {
      profile.segments = [...profile.segments, newSegment];
    });
    console.log(`구간 생성: ${finalLabel} (${finalStartTime}s ~ ${finalEndTime}s)`);

    // 생성된 카드로 스크롤
    this.scrollToSegment(newSegment.id);

    return newSegment; // 생성된 구간을 반환
  }

  private setSegmentEnd() {
    if (!this.video || !this.profile) return;
    
    const currentTime = this.video.currentTime;
    
    // currentTime이 유효하지 않은 경우 처리 (더 엄격한 검사)
    if (currentTime === undefined || currentTime === null || isNaN(currentTime) || typeof currentTime !== 'number') {
      console.log('setSegmentEnd: currentTime이 유효하지 않음', currentTime);
      return;
    }
    
    const lastSegment = this.profile.segments[this.profile.segments.length - 1];
    
    if (lastSegment && lastSegment.start < currentTime) {
      this.updateProfile(profile => {
        profile.segments = profile.segments.map((seg, index) => 
          index === profile.segments.length - 1 
            ? { ...seg, end: currentTime }
            : seg
        );
      });
      console.log(`구간 끝점 설정: ${currentTime}`);
    }
  }

  private activateSegment(segmentId: string) {
    if (!this.profile) return;
    
    this.updateProfile(profile => {
      // 이미 활성화된 구간을 클릭하면 비활성화 (토글)
      if (profile.activeSegmentId === segmentId) {
        profile.activeSegmentId = null;
        console.log(`구간 비활성화: ${segmentId}`);
      } else {
        // 다른 구간을 활성화
        profile.activeSegmentId = segmentId;
        console.log(`구간 활성화: ${segmentId}`);
      }
    });
  }

  private deleteSegment(segmentId: string) {
    if (!this.loopController) return false; // 삭제 실패 시 false 반환
    
    const success = this.loopController.deleteSegment(segmentId);
    if (success) {
      this.saveProfileThrottled();
    }
    return success; // 삭제 성공 시 true, 실패 시 false 반환
  }

  private updateSegment(segmentId: string, updates: any) {
    if (!this.loopController) return false; // 업데이트 실패 시 false 반환

    // 부분 업데이트만 수행 (undefined인 필드는 업데이트하지 않음)
    const updateData: any = {};
    if (updates.label !== undefined) updateData.label = updates.label;
    if (updates.start !== undefined) updateData.start = updates.start;
    if (updates.end !== undefined) updateData.end = updates.end;
    if (updates.rate !== undefined) updateData.rate = updates.rate;

    const success = this.loopController.updateSegment(segmentId, updateData);

    if (success) {
      // 업데이트 후 즉시 루프 컨트롤러에 최신 프로필 반영
      if (this.profile) {
        this.loopController.setProfile(this.profile);
      }
      this.saveProfileThrottled();
    }
    return success; // 업데이트 성공 시 true, 실패 시 false 반환
  }

  private async jumpAndActivateSegment(segmentId: string) {
    console.log('jumpAndActivateSegment 호출됨:', segmentId);

    if (!this.video) {
      console.warn('jumpAndActivateSegment: video가 없음');
      return;
    }

    if (!this.profile) {
      console.warn('jumpAndActivateSegment: profile이 없음');
      return;
    }

    const segment = this.profile.segments.find(s => s.id === segmentId);
    if (!segment) {
      console.error('jumpAndActivateSegment: 구간을 찾을 수 없음:', segmentId);
      return;
    }

    console.log('jumpAndActivateSegment: 찾은 구간:', segment);
    console.log('jumpAndActivateSegment: 현재 activeSegmentId:', this.profile.activeSegmentId);

    // 이미 활성화된 구간을 클릭한 경우
    if (segmentId === this.profile.activeSegmentId) {
      // 영상이 재생 중이면 비활성화 (토글)
      if (!this.video.paused) {
        console.log('jumpAndActivateSegment: 이미 활성화된 구간이므로 비활성화');
        this.activateSegment(segmentId); // 비활성화
      } else {
        // 영상이 정지 중이면 시작 지점으로 이동 후 재생
        console.log('jumpAndActivateSegment: 이미 활성화된 구간, 시작 지점으로 이동 후 재생');
        this.video.currentTime = segment.start;
        this.video.play().catch((error) => {
          console.error('jumpAndActivateSegment: 재생 실패:', error);
        });
      }
    } else {
      // 다른 구간을 활성화: 시작 지점으로 이동
      console.log('jumpAndActivateSegment: 구간 활성화 및 시작 지점으로 이동:', segment.start);
      console.log('jumpAndActivateSegment: video.paused 상태:', this.video.paused);
      this.video.currentTime = segment.start;
      this.activateSegment(segmentId);

      // 영상이 정지 상태면 재생 시작
      if (this.video.paused) {
        console.log('jumpAndActivateSegment: 영상 재생 시작');
        this.video.play().catch((error) => {
          console.error('jumpAndActivateSegment: 재생 실패:', error);
        });
      } else {
        console.log('jumpAndActivateSegment: 영상이 이미 재생 중이므로 play() 호출 안 함');
      }
    }
  }

  private async setSegmentStartTime(segmentId: string) {
    if (!this.video) return;

    const currentTime = this.video.currentTime;

    if (currentTime === undefined || currentTime === null || isNaN(currentTime) || typeof currentTime !== 'number') {
      console.log('setSegmentStartTime: currentTime이 유효하지 않음', currentTime);
      return;
    }

    console.log('[setSegmentStartTime] Start time 변경:', { segmentId, newStartTime: currentTime });

    // 세그먼트의 start time을 현재 재생 위치로 업데이트
    this.updateSegment(segmentId, { start: currentTime });

    // 현재 위치가 새 Start time이므로, 여기서부터 루프가 시작됨
    // 별도의 seek 동작은 필요 없음 (이미 해당 위치에 있음)
  }

  private async setSegmentEndTime(segmentId: string) {
    if (!this.video) return;

    const currentTime = this.video.currentTime;

    if (currentTime === undefined || currentTime === null || isNaN(currentTime) || typeof currentTime !== 'number') {
      console.log('setSegmentEndTime: currentTime이 유효하지 않음', currentTime);
      return;
    }

    this.updateSegment(segmentId, { end: currentTime });
  }

  private decreaseSegmentRate(segmentId: string) {
    const segment = this.profile?.segments.find(s => s.id === segmentId);
    if (!segment) return;

    const currentRate = segment.rate;
    const newRate = Math.max(0.05, currentRate - 0.05); // 5% 감소, 최소 5%

    this.updateSegment(segmentId, { rate: newRate });
  }

  private increaseSegmentRate(segmentId: string) {
    const segment = this.profile?.segments.find(s => s.id === segmentId);
    if (!segment) return;

    const currentRate = segment.rate;
    const newRate = Math.min(1.6, currentRate + 0.05); // 5% 증가, 최대 160%

    this.updateSegment(segmentId, { rate: newRate });
  }

  /**
   * 특정 세그먼트의 End Time부터 8마디를 추가한 새 루프를 생성합니다.
   * 새 루프는 기준 세그먼트 바로 다음에 삽입됩니다.
   */
  private add8BarsAfterSegment(segmentId: string) {
    if (!this.profile || !this.video) return;

    const segment = this.profile.segments.find(s => s.id === segmentId);
    if (!segment) return;

    // BPM과 박자표가 설정되어 있어야 함
    const bpm = this.profile.tempo;
    const timeSignature = this.profile.timeSignature;
    if (!bpm || !timeSignature) {
      console.log('add8BarsAfterSegment: BPM 또는 박자표가 설정되지 않음');
      return;
    }

    // 8마디의 길이(초) 계산
    const duration8Bars = barsToSeconds(8, bpm, timeSignature);

    // 새 세그먼트의 시작/끝 시간
    const newStart = segment.end;
    const newEnd = Math.min(newStart + duration8Bars, this.video.duration);

    // 새 세그먼트 생성
    const safeDefaultRate = typeof this.profile.defaultRate === 'number' && !isNaN(this.profile.defaultRate)
      ? this.profile.defaultRate
      : 1.0;

    // 라벨: "{원본카드라벨} ~ 8 bars"
    const originalLabel = segment.label || 'Loop';
    const newLabel = `${originalLabel} ~ 8 bars`;

    const newSegment: LoopSegment = {
      id: Math.random().toString(36).substring(2, 15),
      start: newStart,
      end: newEnd,
      rate: safeDefaultRate,
      label: newLabel
    };

    // 기준 세그먼트 바로 다음 위치에 삽입
    const segmentIndex = this.profile.segments.findIndex(s => s.id === segmentId);
    this.updateProfile(profile => {
      profile.segments.splice(segmentIndex + 1, 0, newSegment);
    });

    console.log(`8마디 추가: ${newSegment.label} (${newStart.toFixed(3)}s ~ ${newEnd.toFixed(3)}s)`);

    // 생성된 카드로 스크롤
    this.scrollToSegment(newSegment.id);
  }

  /**
   * 세그먼트를 복제합니다.
   * 새 카드의 이름은 "{원본카드} copy", "{원본카드} copy 2", ... 형식입니다.
   */
  private duplicateSegment(segmentId: string) {
    if (!this.profile) return;

    const segment = this.profile.segments.find(s => s.id === segmentId);
    if (!segment) return;

    // 복사본 라벨 생성
    const newLabel = this.generateCopyLabel(segment.label || 'Loop');

    const newSegment: LoopSegment = {
      id: Math.random().toString(36).substring(2, 15),
      start: segment.start,
      end: segment.end,
      rate: segment.rate,
      label: newLabel,
      metronomeEnabled: segment.metronomeEnabled
    };

    // 기준 세그먼트 바로 다음 위치에 삽입
    const segmentIndex = this.profile.segments.findIndex(s => s.id === segmentId);
    this.updateProfile(profile => {
      profile.segments.splice(segmentIndex + 1, 0, newSegment);
    });

    console.log(`세그먼트 복제: ${segment.label} → ${newLabel}`);

    // 생성된 카드로 스크롤
    this.scrollToSegment(newSegment.id);
  }

  /**
   * 복사본 라벨을 생성합니다.
   * 기존 라벨들을 확인하여 "copy", "copy 2", "copy 3" 등의 번호를 결정합니다.
   */
  private generateCopyLabel(originalLabel: string): string {
    if (!this.profile) return `${originalLabel} copy`;

    // 원본 라벨에서 " copy" 또는 " copy N" 패턴 제거하여 베이스 라벨 추출
    const baseLabel = originalLabel.replace(/ copy( \d+)?$/, '');

    // 현재 존재하는 copy 번호들 수집
    const copyPattern = new RegExp(`^${this.escapeRegExp(baseLabel)} copy( (\\d+))?$`);
    const existingNumbers: number[] = [];

    for (const seg of this.profile.segments) {
      const match = seg.label?.match(copyPattern);
      if (match) {
        // "copy"만 있으면 1, "copy N"이면 N
        const num = match[2] ? parseInt(match[2], 10) : 1;
        existingNumbers.push(num);
      }
    }

    // 다음 번호 결정
    if (existingNumbers.length === 0) {
      return `${baseLabel} copy`;
    }

    const maxNumber = Math.max(...existingNumbers);
    return `${baseLabel} copy ${maxNumber + 1}`;
  }

  /**
   * 정규식 특수문자 이스케이프
   */
  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 특정 세그먼트로 스크롤합니다.
   */
  private scrollToSegment(segmentId: string) {
    // UI 렌더링 완료 후 스크롤 실행
    setTimeout(() => {
      this.uiController?.scrollToSegment(segmentId);
    }, 50);
  }

  private updateProfile(updater: (profile: VideoProfile) => void) {
    if (!this.profile) return;
    
    updater(this.profile);
    
    // 디버깅: 프로필 업데이트 후 활성 구간 상태 확인
    console.log('프로필 업데이트:', {
      activeSegmentId: this.profile.activeSegmentId,
      segmentsCount: this.profile.segments.length
    });
    
    this.loopController?.setProfile(this.profile);
    this.saveProfileThrottled();
  }

  private async saveProfile() {
    if (!this.profile) return;
    
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        await saveProfile(this.profile);
        return; // 성공하면 종료
      } catch (error) {
        retryCount++;
        console.error(`프로필 저장 실패 (${retryCount}/${maxRetries}):`, error);
        
        if (retryCount < maxRetries) {
          // 지수 백오프: 1초, 2초, 4초
          const delay = Math.pow(2, retryCount - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error('프로필 저장 최종 실패');
        }
      }
    }
  }

  cleanup() {
    console.log('Loop Practice for YouTube 정리 시작, 이전 videoId:', this.videoId);
    this.isInitialized = false;

    // 카운트인 정지
    this.countIn.stop();

    // 루프 컨트롤러 정리
    if (this.loopController) {
      this.loopController.dispose();
      this.loopController = undefined;
    }

    // UI 제거
    if (this.uiController) {
      this.uiController.cleanup();
      this.uiController = undefined;
    }

    // 프로필 및 비디오 참조 초기화
    this.profile = undefined;
    this.video = undefined;
    // videoId는 유지하여 다음 init()에서 영상 변경 감지 가능

    // 이벤트 리스너 제거
    window.removeEventListener('keydown', this.handleKeydown.bind(this));

    console.log('Loop Practice for YouTube 정리 완료');
  }
}

// Extension 초기화
const extension = new YouTubeLoopPractice();

// 즉시 초기화 시도
const initializeExtension = () => {
  console.log('Content Script 초기화 시작');
  
  // YouTube watch 페이지인지 확인
  if (!isYouTubeWatchPage()) {
    console.log('YouTube watch 페이지가 아님, 초기화 건너뜀');
    return;
  }
  
  // 비디오 요소가 로드될 때까지 대기
  const checkVideoElement = () => {
    const video = document.querySelector('video');
    if (video) {
      console.log('비디오 요소 발견, 확장 프로그램 초기화');
      extension.init().catch(error => {
        console.error('확장 프로그램 초기화 실패:', error);
      });
    } else {
      console.log('비디오 요소 대기 중...');
      setTimeout(checkVideoElement, 100); // 재시도 간격 조정
    }
  };
  
  checkVideoElement();
};

// 즉시 초기화 시도
initializeExtension();

// DOMContentLoaded 이벤트 리스너 (백업)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (!extension.isInitialized) {
      console.log('DOMContentLoaded 후 초기화 시도');
      initializeExtension();
    }
  });
}

// 페이지 로드 완료 후 추가 초기화 시도
window.addEventListener('load', () => {
  setTimeout(() => {
    if (!extension.isInitialized) {
      console.log('페이지 로드 완료 후 추가 초기화 시도');
      initializeExtension();
    }
  }, 500); // 대기 시간 증가
});

// 추가 초기화 시도 (3초 후)
setTimeout(() => {
  if (!extension.isInitialized) {
    console.log('지연 초기화 시도');
    initializeExtension();
  }
}, 3000);

// YouTube SPA 네비게이션 대응
let currentUrl = location.href;
const checkNavigation = () => {
  if (location.href !== currentUrl) {
    currentUrl = location.href;
    console.log('YouTube 네비게이션 감지:', currentUrl);
    extension.cleanup();
    setTimeout(() => {
      console.log('네비게이션 후 재초기화');
      initializeExtension();
    }, 500); // 더 짧은 대기 시간
  }
};

// URL 변경 감지
window.addEventListener('popstate', checkNavigation);
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function(...args) {
  originalPushState.apply(history, args);
  setTimeout(checkNavigation, 0);
};

history.replaceState = function(...args) {
  originalReplaceState.apply(history, args);
  setTimeout(checkNavigation, 0);
};