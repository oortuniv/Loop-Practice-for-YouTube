import { getVideoIdFromUrl, isYouTubeWatchPage, waitForVideoElement, onYouTubeNavigation } from './youtube';
import { loadProfile, saveProfile } from './storage';
import { LoopController } from './loops';
import { Metronome } from './audio/metronome';
import { CountIn } from './audio/countin';
import { BpmDetector } from './audio/bpm';
// 오버레이 관련 import는 팝업 기반으로 변경되어 더 이상 사용하지 않음
import { isInputElement, clamp, throttle } from '../utils';
import { VideoProfile, LoopSegment } from '../types';

export class YouTubeLoopPractice {
  private video?: HTMLVideoElement;
  private videoId?: string;
  private profile?: VideoProfile;
  private loopController?: LoopController;
  private metronome = new Metronome();
  private countIn = new CountIn();
  private bpmDetector = new BpmDetector();
  // 오버레이 컨테이너는 팝업 기반으로 변경되어 더 이상 사용하지 않음
  public isInitialized = false;
  private saveProfileThrottled: () => void;

  constructor() {
    this.saveProfileThrottled = throttle(() => this.saveProfile(), 1000);
    
    // 즉시 메시지 리스너 등록 (초기화 전에도 응답 가능하도록)
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
    console.log('Content Script 메시지 리스너 등록 완료');
  }

  async init() {
    if (this.isInitialized) return;

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
      this.videoId = videoId;
      console.log('비디오 ID:', videoId);

      // 프로필 로드
      this.profile = await loadProfile(this.videoId);
      console.log('프로필 로드 완료:', this.profile);

      // 루프 컨트롤러 초기화
      this.loopController = new LoopController(this.video, this.profile);
      console.log('루프 컨트롤러 초기화 완료');

      // 이벤트 리스너 설정
      this.setupEventListeners();
      console.log('이벤트 리스너 설정 완료');

      // YouTube 네비게이션 감지
      onYouTubeNavigation(() => {
        console.log('YouTube 네비게이션 감지, 정리 후 재초기화');
        this.cleanup();
        setTimeout(() => this.init(), 1000);
      });

      this.isInitialized = true;
      console.log('YouTube Loop & Practice 초기화 완료');

      // 초기화 완료 후 활성 구간이 있으면 즉시 적용
      if (this.profile.activeSegmentId) {
        console.log('활성 구간 복원:', this.profile.activeSegmentId);
        this.loopController.setActive(this.profile.activeSegmentId);
      }

    } catch (error) {
      console.error('초기화 실패:', error);
    }
  }

  private setupEventListeners() {
    if (!this.video || !this.loopController) return;

    console.log('이벤트 리스너 설정 시작');

    // 비디오 timeupdate 이벤트
    this.video.addEventListener('timeupdate', () => {
      this.loopController?.onTimeUpdate();
    });

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
      case 'b':
        e.preventDefault();
        this.toggleBpmDetection();
        break;
      case 'm':
        e.preventDefault();
        this.toggleMetronome();
        break;
      case 'c':
        e.preventDefault();
        this.runCountIn();
        break;
      case 't':
        e.preventDefault();
        this.tapTempo();
        break;
    }
  }

  private handleMessage(message: any, _sender: any, sendResponse: any) {
    try {
      console.log('Content Script 메시지 수신:', message);
      
      // 초기화되지 않은 상태에서도 응답 가능한 메시지들
      if (message?.type === 'PING') {
        console.log('PING 메시지 수신, 응답 전송');
        sendResponse({ status: 'ok', timestamp: Date.now(), initialized: this.isInitialized });
        return true;
      }
      
      if (message?.type === 'GET_CURRENT_TIME') {
        const currentTime = this.video?.currentTime || 0;
        console.log('현재 시간 요청:', currentTime);
        sendResponse({ currentTime });
        return true;
      }
      
      // 초기화되지 않은 상태에서는 다른 메시지에 에러 응답
      if (!this.isInitialized) {
        console.log('Content Script가 초기화되지 않음, 메시지 무시:', message?.type);
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
          case 'toggle-metronome':
            this.toggleMetronome();
            break;
          case 'count-in':
            this.runCountIn();
            break;
          case 'tap-tempo':
            this.tapTempo();
            break;
          case 'set-segment-end':
            this.setSegmentEnd();
            break;
        }
        sendResponse({ success: true });
      } else if (message?.type === 'SET_BPM') {
        this.setBpm(message.bpm);
        sendResponse({ success: true });
      } else if (message?.type === 'CREATE_SEGMENT') {
        const result = this.createSegment(message.label);
        sendResponse({ success: !!result, segment: result });
      } else if (message?.type === 'ACTIVATE_SEGMENT') {
        this.activateSegment(message.segmentId);
        sendResponse({ success: true });
      } else if (message?.type === 'DELETE_SEGMENT') {
        const success = this.deleteSegment(message.segmentId);
        sendResponse({ success });
      } else if (message?.type === 'UPDATE_SEGMENT') {
        // 필요한 필드만 추출하여 전달
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
        console.log('알 수 없는 메시지 타입:', message?.type);
        sendResponse({ error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('메시지 처리 중 오류:', error);
      sendResponse({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
    
    // 비동기 응답을 위해 true 반환
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
    if (!this.profile || !this.loopController) return;

    const activeSegment = this.profile.segments.find(s => s.id === this.profile!.activeSegmentId);
    
    if (activeSegment) {
      // 활성 구간이 있으면 비활성화
      this.updateProfile(profile => {
        profile.activeSegmentId = null;
      });
    } else {
      // 현재 시간에 해당하는 구간을 활성화
      const currentTime = this.video?.currentTime;
      
      // currentTime이 유효하지 않은 경우 처리 (더 엄격한 검사)
      if (currentTime === undefined || currentTime === null || isNaN(currentTime) || typeof currentTime !== 'number') {
        console.log('toggleLoop: currentTime이 유효하지 않음', currentTime);
        return;
      }
      
      const segmentAtTime = this.profile.segments.find(s => 
        currentTime >= s.start && currentTime <= s.end
      );
      if (segmentAtTime) {
        this.updateProfile(profile => {
          profile.activeSegmentId = segmentAtTime.id;
        });
      }
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

  private toggleBpmDetection() {
    if (!this.video || !this.profile) return;

    // BPM 감지 실행
    this.bpmDetector.detectFromVideo(this.video, 3).then(bpm => {
      if (bpm) {
        this.updateProfile(profile => {
          profile.bpm = bpm;
        });
        console.log(`BPM 감지 완료: ${bpm}`);
      } else {
        console.log('BPM 감지 실패. 탭 템포를 사용하세요.');
      }
    });
  }

  private toggleMetronome() {
    if (!this.profile?.bpm) {
      console.log('BPM이 설정되지 않았습니다.');
      return;
    }

    if (this.metronome.isRunning()) {
      this.metronome.stop();
      this.updateProfile(profile => {
        profile.metronomeEnabled = false;
      });
    } else {
      this.metronome.start(this.profile.bpm);
      this.updateProfile(profile => {
        profile.metronomeEnabled = true;
      });
    }
  }

  private runCountIn() {
    if (!this.profile?.bpm || !this.video || !this.loopController) {
      console.log('BPM이 설정되지 않았습니다.');
      return;
    }

    const activeSegment = this.loopController.getActive();
    if (!activeSegment) {
      console.log('활성 구간이 없습니다.');
      return;
    }

    this.countIn.run({
      beats: this.profile.countInBeats || 4,
      bpm: this.profile.bpm,
      onComplete: () => {
        // currentTime이 유효한지 확인
        if (this.video && activeSegment.start !== undefined && !isNaN(activeSegment.start)) {
          this.video.currentTime = activeSegment.start;
          this.video.play().catch(() => {});
        } else {
          console.log('runCountIn: activeSegment.start이 유효하지 않음', activeSegment.start);
        }
      }
    });
  }

  private tapTempo() {
    const bpm = this.bpmDetector.tapTempo();
    if (bpm) {
      this.updateProfile(profile => {
        profile.bpm = bpm;
      });
      console.log(`탭 템포 BPM: ${bpm}`);
    }
  }

  private setBpm(bpm: number) {
    if (bpm >= 60 && bpm <= 200) {
      this.updateProfile(profile => {
        profile.bpm = bpm;
      });
      console.log(`BPM 설정: ${bpm}`);
    }
  }

  private createSegment(label: string) {
    if (!this.video || !this.profile) return;
    
    const currentTime = this.video.currentTime;
    
    // currentTime이 유효하지 않은 경우 처리 (더 엄격한 검사)
    if (currentTime === undefined || currentTime === null || isNaN(currentTime) || typeof currentTime !== 'number') {
      console.log('createSegment: currentTime이 유효하지 않음', currentTime);
      return;
    }
    
    const endTime = Math.min(currentTime + 10, this.video.duration);
    
    // 안전한 defaultRate 계산
    const safeDefaultRate = typeof this.profile.defaultRate === 'number' && !isNaN(this.profile.defaultRate) 
      ? this.profile.defaultRate 
      : 1.0;
    
    // 라벨이 비어있으면 시작 시간 ~ 끝 시간을 기준으로 자동 지정
    let finalLabel = label;
    if (!finalLabel) {
      const startMins = Math.floor(currentTime / 60);
      const startSecs = Math.floor(currentTime % 60);
      const endMins = Math.floor(endTime / 60);
      const endSecs = Math.floor(endTime % 60);
      finalLabel = `${startMins}:${startSecs.toString().padStart(2, '0')}~${endMins}:${endSecs.toString().padStart(2, '0')}`;
    }
    
    const newSegment: LoopSegment = {
      id: Math.random().toString(36).substring(2, 15),
      start: currentTime,
      end: endTime,
      rate: safeDefaultRate,
      label: finalLabel
    };

    this.updateProfile(profile => {
      profile.segments = [...profile.segments, newSegment];
    });
    console.log(`구간 생성: ${finalLabel}`);
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
      this.saveProfileThrottled();
    }
    return success; // 업데이트 성공 시 true, 실패 시 false 반환
  }

  // 오버레이 관련 메서드는 팝업 기반으로 변경되어 더 이상 사용하지 않음

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
    this.isInitialized = false;
    
    // 메트로놈 정지
    this.metronome.stop();
    
    // 카운트인 정지
    this.countIn.stop();
    
    // 오버레이 제거는 팝업 기반으로 변경되어 더 이상 사용하지 않음
    
    // 이벤트 리스너 제거
    if (this.video) {
      this.video.removeEventListener('timeupdate', () => {});
    }
    
    window.removeEventListener('keydown', this.handleKeydown.bind(this));
    chrome.runtime.onMessage.removeListener(this.handleMessage.bind(this));
    
    console.log('YouTube Loop & Practice 정리 완료');
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
      setTimeout(checkVideoElement, 50); // 더 빠른 재시도
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
  }, 200); // 더 짧은 대기 시간
});

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