import { LoopSegment, VideoProfile } from '../types';
import { throttle } from '../utils';
import { Metronome } from './audio/metronome';

export class LoopController {
  private video: HTMLVideoElement;
  private profile: VideoProfile;
  private active?: LoopSegment;
  private tickThrottled: () => void;
  private metronome: Metronome;
  private globalSyncMetronomeActive: boolean = false; // 글로벌 싱크 메트로놈 활성화 상태

  // 메트로놈 비트 콜백 (UI 업데이트용)
  private metronomeBeatCallback: ((beat: number, total: number) => void) | null = null;

  // 루프 점프 처리 플래그 (중복 호출 방지)
  private isJumping: boolean = false;

  // 카운트인 관련 상태
  private countInActive: boolean = false;
  private countInVideoStartTimer: number | null = null;
  private countInTargetSegmentStart: number | null = null; // 하이브리드 모드에서 감지할 시작점
  private countInOnComplete: (() => void) | null = null; // 카운트인 완료 콜백
  private countInTimeUpdateHandler: (() => void) | null = null; // timeupdate 핸들러 참조

  constructor(video: HTMLVideoElement, profile: VideoProfile) {
    this.video = video;
    this.profile = profile;
    this.tickThrottled = throttle(() => this.tick(), 50); // 100ms → 50ms로 단축
    this.metronome = new Metronome();
    this.metronome.setVideo(video); // 비디오 엘리먼트 설정

    // 초기 활성 구간 설정
    if (profile.activeSegmentId) {
      this.setActive(profile.activeSegmentId);
    }

    // 비디오 일시정지 시 메트로놈 중지
    this.video.addEventListener('pause', () => {
      if (this.metronome.isRunning()) {
        // 소리만 멈추고 플래그는 유지 (재생 시 다시 시작하기 위해)
        this.metronome.stop();
      }
    });

    // 비디오 재생 시 메트로놈 재시작
    // 'playing' 이벤트 사용: 실제로 재생이 시작된 후 발생하므로 타이밍이 더 정확함
    // 'play' 이벤트는 재생 요청 시점에 발생하여 실제 재생과 수십~수백ms 차이 발생 가능
    this.video.addEventListener('playing', () => {
      // 카운트인 중에는 메트로놈 자동 시작 안함 (카운트인 완료 후 시작됨)
      if (this.countInActive) {
        return;
      }

      // 루프 점프 중에는 메트로놈 재시작 안함 (resync만 사용)
      // video.currentTime 변경 시 playing 이벤트가 다시 발생할 수 있음
      if (this.isJumping) {
        console.log('[LoopController] playing 이벤트 무시 (루프 점프 중)');
        return;
      }

      // 메트로놈이 이미 실행 중이면 재시작하지 않음
      if (this.metronome.isRunning()) {
        console.log('[LoopController] playing 이벤트 무시 (메트로놈 이미 실행 중)');
        return;
      }

      if (this.globalSyncMetronomeActive) {
        this.startGlobalSyncMetronome();
      } else if (this.active?.metronomeEnabled) {
        this.startMetronome();
      }
    });

    // 메트로놈에 루프 점프 콜백 설정
    // 메트로놈이 10ms마다 video.currentTime을 체크하므로
    // RAF(16ms)나 timeupdate(250ms)보다 빠르게 loopEnd 도달을 감지
    this.metronome.setOnLoopJumpRequest((start) => {
      this.handleLoopJump(start);
    });
  }

  /**
   * 루프 점프 처리 (메트로놈에서 호출)
   */
  private handleLoopJump(start: number): void {
    if (this.isJumping) return; // 중복 호출 방지
    this.isJumping = true;

    console.log(`[LoopController] 루프 점프: → ${start.toFixed(3)}s`);
    this.video.currentTime = start;
    this.metronome.resync(start);

    // 다음 프레임에서 플래그 해제
    requestAnimationFrame(() => {
      this.isJumping = false;
    });
  }

  setProfile(profile: VideoProfile): void {
    this.profile = profile;
    console.log('LoopController setProfile:', {
      activeSegmentId: profile.activeSegmentId,
      segmentsCount: profile.segments.length
    });
    // 활성 구간 상태도 함께 업데이트 (profile.activeSegmentId 사용)
    if (profile.activeSegmentId) {
      const foundSegment = profile.segments.find(s => s.id === profile.activeSegmentId);
      console.log('setProfile에서 찾은 구간:', foundSegment);
      this.active = foundSegment || undefined;
    } else {
      this.active = undefined;
      // 루프 비활성화 시 메트로놈 중지
      if (this.metronome.isRunning()) {
        this.stopMetronome();
      }
    }

    this.applyActiveRate();

    // 디버깅 로그
    if (this.active) {
      console.log(`setProfile 후 루프 활성화: ${this.active.label} (${this.active.start}s ~ ${this.active.end}s)`);
    } else {
      console.log('setProfile 후 루프 비활성화');
    }
  }

  setActive(id?: string | null): void {
    console.log('setActive 호출됨:', { id, segmentsCount: this.profile.segments.length });

    // profile 객체를 직접 수정하지 않고 activeSegmentId만 업데이트
    if (id) {
      const foundSegment = this.profile.segments.find(s => s.id === id);
      console.log('찾은 구간:', foundSegment);
      this.active = foundSegment || undefined;
    } else {
      this.active = undefined;
    }

    this.applyActiveRate();

    // 메트로놈 처리 (루프 점프는 메트로놈이 10ms마다 감지)
    if (this.active) {
      console.log(`루프 활성화: ${this.active.label} (${this.active.start}s ~ ${this.active.end}s)`);

      // 메트로놈이 활성화되어 있고 비디오가 재생 중이면 재시작
      if (this.active.metronomeEnabled && !this.video.paused) {
        this.stopMetronome();
        this.startMetronome();
      }

      // 메트로놈 루프 범위 설정 (loopEnd 도달 시 handleLoopJump 호출)
      this.metronome.setLoopRange(this.active.start, this.active.end);
    } else {
      console.log('루프 비활성화');

      // 루프 비활성화 시 메트로놈 중지 및 루프 범위 해제
      this.metronome.clearLoopRange();
      if (this.metronome.isRunning()) {
        this.stopMetronome();
      }
    }
  }

  getActive(): LoopSegment | undefined {
    return this.active;
  }

  getProfile(): VideoProfile {
    return this.profile;
  }

  tick(): void {
    if (!this.active) {
      return;
    }

    // 최신 segment 정보를 profile에서 가져옴 (실시간 업데이트 반영)
    const latestSegment = this.profile.segments.find(s => s.id === this.active!.id);
    if (!latestSegment) {
      return;
    }

    const { start, end } = latestSegment;

    // start와 end 값이 유효하지 않은 경우 처리
    if (start === undefined || start === null || isNaN(start) || typeof start !== 'number' ||
        end === undefined || end === null || isNaN(end) || typeof end !== 'number') {
      console.log('루프 체크: start 또는 end 값이 유효하지 않음', { start, end });
      return;
    }

    // start가 end보다 큰 경우 처리 (무효한 구간)
    if (start >= end) {
      console.log('루프 체크: start가 end보다 크거나 같음 (무효한 구간)', { start, end });
      return;
    }

    const currentTime = this.video.currentTime;

    // currentTime이 유효하지 않은 경우 처리 (더 엄격한 검사)
    if (currentTime === undefined || currentTime === null || isNaN(currentTime) || typeof currentTime !== 'number') {
      console.log('루프 체크: currentTime이 유효하지 않음', currentTime);
      return;
    }

    // 메트로놈이 활성화되어 있고 재생 중이면 메트로놈 시작
    if (latestSegment.metronomeEnabled && !this.video.paused && !this.metronome.isRunning()) {
      this.startMetronome();
    }

    // 메트로놈 루프 범위 업데이트 (글로벌 싱크 메트로놈 포함)
    if (this.metronome.isRunning()) {
      this.metronome.setLoopRange(start, end);
    }

    // 루프 점프는 RAF에서 처리 (더 정밀한 타이밍)
    // tick()은 메트로놈 상태 관리만 담당
  }

  // timeupdate 이벤트에서 호출
  onTimeUpdate(): void {
    this.tickThrottled();
  }

  gotoPrevNext(dir: -1 | 1): void {
    const currentTime = this.video.currentTime;
    
    // currentTime이 유효하지 않은 경우 처리 (더 엄격한 검사)
    if (currentTime === undefined || currentTime === null || isNaN(currentTime) || typeof currentTime !== 'number') {
      console.log('gotoPrevNext: currentTime이 유효하지 않음', currentTime);
      return;
    }
    
    const segments = [...this.profile.segments].sort((a, b) => a.start - b.start);
    
    if (segments.length === 0) return;

    if (dir > 0) {
      // 다음 구간: 현재 시간보다 큰 start 중 최소값
      const next = segments.find(s => s.start > currentTime) ?? segments[0];
      this.setActive(next?.id);
      if (next && typeof next.start === 'number' && !isNaN(next.start)) {
        this.video.currentTime = next.start;
      }
    } else {
      // 이전 구간: 현재 시간보다 작은 start 중 최대값
      const prev = [...segments].reverse().find(s => s.start < currentTime) ?? segments[segments.length - 1];
      this.setActive(prev?.id);
      if (prev && typeof prev.start === 'number' && !isNaN(prev.start)) {
        this.video.currentTime = prev.start;
      }
    }
    
    this.applyActiveRate();
  }

  applyActiveRate(): void {
    // 안전성 검사 추가
    const safeDefaultRate = typeof this.profile.defaultRate === 'number' && !isNaN(this.profile.defaultRate) 
      ? this.profile.defaultRate 
      : 1.0;
    
    const rate = this.active?.rate ?? safeDefaultRate;
    this.video.playbackRate = rate;
  }

  // 현재 시간을 기준으로 구간 생성
  createSegmentFromCurrentTime(type: 'start' | 'end', label?: string): LoopSegment | null {
    const currentTime = this.video.currentTime;
    
    // currentTime이 유효하지 않은 경우 처리 (더 엄격한 검사)
    if (currentTime === undefined || currentTime === null || isNaN(currentTime) || typeof currentTime !== 'number') {
      console.log('createSegmentFromCurrentTime: currentTime이 유효하지 않음', currentTime);
      return null;
    }
    
    // 안전한 defaultRate 계산
    const safeDefaultRate = typeof this.profile.defaultRate === 'number' && !isNaN(this.profile.defaultRate) 
      ? this.profile.defaultRate 
      : 1.0;
    
    if (type === 'start') {
      const endTime = Math.min(currentTime + 10, this.video.duration);
      
      // endTime이 유효하지 않은 경우 처리
      if (endTime === undefined || endTime === null || isNaN(endTime) || typeof endTime !== 'number') {
        console.log('createSegmentFromCurrentTime: endTime이 유효하지 않음', endTime);
        return null;
      }
      
      let segmentLabel = label;
      if (!segmentLabel) {
        const startMin = Math.floor(currentTime / 60);
        const startSec = Math.floor(currentTime % 60);
        const endMin = Math.floor(endTime / 60);
        const endSec = Math.floor(endTime % 60);
        segmentLabel = `${startMin.toString().padStart(2, '0')}:${startSec.toString().padStart(2, '0')}~${endMin.toString().padStart(2, '0')}:${endSec.toString().padStart(2, '0')}`;
      }
      
      const segment: LoopSegment = {
        id: Math.random().toString(36).substring(2, 15),
        start: currentTime,
        end: endTime,
        rate: safeDefaultRate,
        label: segmentLabel
      };
      
      this.profile.segments.push(segment);
      return segment;
    } else {
      // end 타입: 마지막 구간의 끝점을 현재 시간으로 설정
      const lastSegment = this.profile.segments[this.profile.segments.length - 1];
      
      if (lastSegment && lastSegment.start < currentTime) {
        lastSegment.end = currentTime;
        
        // 라벨이 없거나 기본 라벨인 경우 업데이트
        if (!lastSegment.label || lastSegment.label.startsWith('구간 ')) {
          const startMin = Math.floor(lastSegment.start / 60);
          const startSec = Math.floor(lastSegment.start % 60);
          const endMin = Math.floor(currentTime / 60);
          const endSec = Math.floor(currentTime % 60);
          lastSegment.label = `${startMin.toString().padStart(2, '0')}:${startSec.toString().padStart(2, '0')}~${endMin.toString().padStart(2, '0')}:${endSec.toString().padStart(2, '0')}`;
        }
        
        return lastSegment;
      }
    }
    
    return null;
  }

  // 구간 업데이트
  updateSegment(id: string, updates: Partial<LoopSegment>): boolean {
    const segment = this.profile.segments.find(s => s.id === id);
    if (!segment) return false;

    // 업데이트 전 유효성 검사
    const newStart = updates.start !== undefined ? updates.start : segment.start;
    const newEnd = updates.end !== undefined ? updates.end : segment.end;

    // start와 end 값이 유효한지 확인
    if (typeof newStart === 'number' && typeof newEnd === 'number' && !isNaN(newStart) && !isNaN(newEnd)) {
      if (newStart >= newEnd) {
        console.log('구간 업데이트 실패: start가 end보다 크거나 같음', { newStart, newEnd });
        return false;
      }
    }

    Object.assign(segment, updates);

    // 활성 구간이 업데이트된 경우 속도 재적용 및 메트로놈 재시작
    if (this.active?.id === id) {
      this.applyActiveRate();

      // start 또는 end가 변경되었고, 메트로놈이 활성화되어 있으면 재시작
      if ((updates.start !== undefined || updates.end !== undefined) &&
          this.active.metronomeEnabled && !this.video.paused) {
        this.stopMetronome();
        this.startMetronome();
      }
    }

    return true;
  }

  // 구간 삭제
  deleteSegment(id: string): boolean {
    const index = this.profile.segments.findIndex(s => s.id === id);
    if (index === -1) return false;
    
    this.profile.segments.splice(index, 1);
    
    // 삭제된 구간이 활성 구간이었다면 활성 구간 해제
    if (this.active?.id === id) {
      this.setActive(null);
    }
    
    return true;
  }

  // 기본 재생 속도 변경
  setDefaultRate(rate: number): void {
    this.profile.defaultRate = rate;
    this.applyActiveRate();
  }

  // 현재 시간이 포함된 구간 찾기
  getSegmentAtCurrentTime(): LoopSegment | undefined {
    const currentTime = this.video.currentTime;

    // currentTime이 유효하지 않은 경우 처리 (더 엄격한 검사)
    if (currentTime === undefined || currentTime === null || isNaN(currentTime) || typeof currentTime !== 'number') {
      console.log('getSegmentAtCurrentTime: currentTime이 유효하지 않음', currentTime);
      return undefined;
    }

    return this.profile.segments.find(s =>
      currentTime >= s.start && currentTime <= s.end
    );
  }

  /**
   * 메트로놈 토글 (특정 segment에 대해)
   * @param segmentId 토글할 segment ID
   * @returns 메트로놈 활성화 상태
   */
  toggleMetronome(segmentId: string): boolean {
    const segment = this.profile.segments.find(s => s.id === segmentId);
    if (!segment) return false;

    // segment의 메트로놈 상태 토글
    segment.metronomeEnabled = !segment.metronomeEnabled;

    // 활성 루프의 메트로놈을 토글한 경우
    if (this.active?.id === segmentId) {
      if (segment.metronomeEnabled) {
        // 활성화: 재생 중이면 메트로놈 시작
        if (!this.video.paused) {
          this.startMetronome();
        }
      } else {
        // 비활성화: 메트로놈 중지
        this.stopMetronome();
      }
    }

    return segment.metronomeEnabled;
  }

  /**
   * 특정 segment의 메트로놈 활성화 상태 확인
   */
  isMetronomeEnabled(segmentId: string): boolean {
    const segment = this.profile.segments.find(s => s.id === segmentId);
    return segment?.metronomeEnabled || false;
  }

  /**
   * 세그먼트의 유효 Beat Sync 설정을 반환합니다.
   * 로컬 설정이 있으면 로컬, 없으면 글로벌 설정을 반환합니다.
   */
  private getEffectiveSync(segment: LoopSegment): {
    tempo: number | undefined;
    timeSignature: string | undefined;
    offset: number | undefined;
  } {
    if (segment.useGlobalSync !== false) {
      // 글로벌 설정 사용
      return {
        tempo: this.profile.tempo,
        timeSignature: this.profile.timeSignature,
        offset: this.profile.globalMetronomeOffset
      };
    } else {
      // 로컬 설정 사용
      return {
        tempo: segment.localTempo,
        timeSignature: segment.localTimeSignature,
        offset: segment.localMetronomeOffset
      };
    }
  }

  /**
   * 메트로놈 시작
   */
  private startMetronome(): void {
    if (!this.active) {
      console.log('메트로놈 시작 실패: 활성 루프 없음');
      return;
    }

    // 유효 Beat Sync 설정 가져오기
    const effectiveSync = this.getEffectiveSync(this.active);

    if (!effectiveSync.tempo || !effectiveSync.timeSignature) {
      console.log('메트로놈 시작 실패: BPM 또는 박자표 미설정');
      return;
    }

    // 오프셋 = 첫 박 시간 (video.currentTime 기준)
    const metronomeOffset = effectiveSync.offset || 0;
    const loopDuration = this.active.end - this.active.start;

    // 루프 범위 설정 (end 이후의 박은 스케줄하지 않음)
    this.metronome.setLoopRange(this.active.start, this.active.end);

    this.metronome.start(
      effectiveSync.tempo,
      effectiveSync.timeSignature,
      metronomeOffset,
      loopDuration
    );

    console.log('메트로놈 시작 (video.currentTime 기반):', {
      bpm: effectiveSync.tempo,
      timeSignature: effectiveSync.timeSignature,
      videoCurrentTime: this.video.currentTime,
      metronomeOffset,
      loopDuration,
      loopRange: { start: this.active.start, end: this.active.end },
      useGlobalSync: this.active.useGlobalSync !== false
    });
  }

  /**
   * 메트로놈 중지
   */
  private stopMetronome(): void {
    this.metronome.stop();
    this.metronome.clearLoopRange();
    console.log('메트로놈 중지');
  }

  /**
   * 글로벌 싱크 메트로놈 시작 (루프 없이)
   * 전체 영상에 대해 글로벌 오프셋만 적용하여 메트로놈 재생
   */
  startGlobalSyncMetronome(): void {
    if (!this.profile.tempo || !this.profile.timeSignature) {
      console.log('[Global Sync Metronome] 시작 실패: BPM 또는 박자표 미설정');
      return;
    }

    // 활성화 플래그 설정
    this.globalSyncMetronomeActive = true;

    // 글로벌 오프셋 = 첫 박 시간
    const globalOffset = this.profile.globalMetronomeOffset || 0;

    // 루프 길이 없이 메트로놈 시작 (무한 재생)
    this.metronome.start(
      this.profile.tempo,
      this.profile.timeSignature,
      globalOffset
    );

    console.log('[Global Sync Metronome] 시작 (video.currentTime 기반):', {
      bpm: this.profile.tempo,
      timeSignature: this.profile.timeSignature,
      videoCurrentTime: this.video.currentTime,
      globalOffset
    });
  }

  /**
   * 글로벌 싱크 메트로놈 중지
   */
  stopGlobalSyncMetronome(): void {
    this.globalSyncMetronomeActive = false;
    this.metronome.stop();
    console.log('[Global Sync Metronome] 중지');
  }

  /**
   * 메트로놈 볼륨 설정
   * @param volume 볼륨 (0.0 ~ 1.0)
   */
  setMetronomeVolume(volume: number): void {
    this.metronome.setVolume(volume);
  }

  /**
   * 메트로놈 비트 콜백 설정 (UI 업데이트용)
   * @param callback 각 박마다 호출되는 콜백 (beat: 1부터 시작, total: 총 박 수)
   */
  setMetronomeBeatCallback(callback: ((beat: number, total: number) => void) | null): void {
    this.metronomeBeatCallback = callback;

    // 카운트인 중이 아닐 때만 메트로놈 콜백 설정
    if (!this.countInActive) {
      if (callback) {
        this.metronome.setOnBeatCallback((beatNumber, beatsPerBar) => {
          callback(beatNumber, beatsPerBar);
          return true; // 클릭음 재생
        });
      } else {
        this.metronome.setOnBeatCallback(null);
      }
    }
  }

  /**
   * 카운트인 시작 (단순화된 버전)
   * 카운트인 = "1마디 먼저 시작하는 메트로놈"
   *
   * @param segmentId 루프 세그먼트 ID
   * @param onBeat 각 박마다 호출되는 콜백 (UI 업데이트용)
   * @param onComplete 루프 시작점 도달 시 호출되는 콜백
   */
  startCountIn(
    segmentId: string,
    onBeat: (beat: number, total: number) => void,
    onComplete: () => void
  ): void {
    const segment = this.profile.segments.find(s => s.id === segmentId);
    if (!segment) {
      console.error('[Count-In] 세그먼트를 찾을 수 없음:', segmentId);
      return;
    }

    // 유효 Beat Sync 설정 가져오기
    const effectiveSync = this.getEffectiveSync(segment);
    if (!effectiveSync.tempo || !effectiveSync.timeSignature) {
      console.error('[Count-In] BPM 또는 박자표 미설정');
      return;
    }

    const beatsPerBar = parseInt(effectiveSync.timeSignature.split('/')[0], 10);
    const bpm = effectiveSync.tempo;
    const beatDuration = 60 / bpm;
    const barDuration = beatDuration * beatsPerBar;

    // prerollPosition 계산: 루프 시작점에서 1마디 전
    const prerollPosition = segment.start - barDuration;

    console.log('[Count-In] 시작:', {
      segmentId,
      bpm,
      beatsPerBar,
      barDuration,
      loopStart: segment.start,
      prerollPosition
    });

    this.countInActive = true;

    if (prerollPosition >= 0) {
      // Case 1: 충분한 여유 공간 - 영상 미리 재생하며 메트로놈으로 카운트인
      console.log('[Count-In] Case 1 - 하이브리드 모드');

      // 카운트인 완료 감지를 위한 상태 저장
      this.countInTargetSegmentStart = segment.start;
      this.countInOnComplete = onComplete;

      // 루프는 아직 활성화하지 않음 (카운트인 완료 후 활성화)
      // 메트로놈 설정: segment.start를 첫 박(downbeat)으로 설정
      // prerollPosition에서 시작하면 beat -4, -3, -2, -1 → 0(루프시작) 순서로 재생

      // 카운트인 시작 박 인덱스 저장 (UI 표시용)
      let countInBeatCounter = 0;

      this.metronome.setOnBeatCallback((beatNumber, beatsPerBar) => {
        // 카운트인 중에는 1, 2, 3, 4 순서로 표시
        // countInActive가 true일 때만 카운트인 번호 사용
        if (this.countInActive) {
          countInBeatCounter++;

          // beatsPerBar를 초과하면 카운트인 완료 (beat 0 = 루프 시작)
          if (countInBeatCounter > beatsPerBar) {
            // 카운트인 완료 처리 (beat 0에서 호출됨)
            // 메트로놈이 계속 재생되어야 하는지 확인
            const segmentMetronomeEnabled = segment.metronomeEnabled || false;
            const shouldContinueMetronome = segmentMetronomeEnabled || this.globalSyncMetronomeActive;

            this.completeCountIn(segmentId);

            // 메트로놈이 계속 재생되어야 하면 beat 0 클릭음도 재생
            return shouldContinueMetronome;
          }

          // 카운트인 박 번호 (1, 2, 3, 4)
          onBeat(countInBeatCounter, beatsPerBar);
          return true; // 클릭음 재생
        } else {
          // 카운트인 완료 후에는 메트로놈의 실제 박 번호 사용
          onBeat(beatNumber, beatsPerBar);
          return true; // 클릭음 재생
        }
      });

      // timeupdate 이벤트로 segment.start 도달 감지
      this.countInTimeUpdateHandler = () => {
        this.checkCountInComplete(segmentId);
      };
      this.video.addEventListener('timeupdate', this.countInTimeUpdateHandler);

      // 중요: 영상 위치를 먼저 설정한 후 메트로놈 시작
      this.video.currentTime = prerollPosition;

      const loopDuration = segment.end - segment.start;
      // startBeatIndex: -beatsPerBar - 1 = -5 (4/4의 경우)
      // 이렇게 하면 beat -4, -3, -2, -1 총 4박이 재생됨 (beat 0은 루프 시작)
      const startBeatIndex = -beatsPerBar - 1;
      this.metronome.start(
        bpm,
        effectiveSync.timeSignature,
        segment.start, // 루프 시작점이 첫 박 (beat 0)
        loopDuration,
        startBeatIndex
      );

      // 영상 재생
      this.video.play().catch(err => console.error('[Count-In] 영상 재생 실패:', err));

    } else {
      // Case 2: 영상 시작 근처 - 타이머로 카운트인 후 영상 시작
      console.log('[Count-In] Case 2 - 타이머 모드');

      // 영상을 시작점으로 이동 (아직 재생 안 함)
      this.video.currentTime = segment.start;

      // 타이머 기반 카운트인
      this.startTimerBasedCountIn(segment, bpm, beatsPerBar, onBeat, onComplete);
    }
  }

  /**
   * 타이머 기반 카운트인 (prerollPosition < 0인 경우)
   * 영상 정지 상태에서 setTimeout으로 박 재생
   */
  private startTimerBasedCountIn(
    segment: LoopSegment,
    bpm: number,
    beatsPerBar: number,
    onBeat: (beat: number, total: number) => void,
    onComplete: () => void
  ): void {
    const beatDuration = 60 / bpm;
    let currentBeat = 0;

    const ctx = this.metronome.getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const playNextBeat = () => {
      if (!this.countInActive) return;

      const isDownbeat = currentBeat === 0;

      // 클릭음 재생
      this.metronome.playClickNow(isDownbeat);

      // UI 콜백
      onBeat(currentBeat + 1, beatsPerBar);

      currentBeat++;

      if (currentBeat < beatsPerBar) {
        // 다음 박 스케줄
        this.countInVideoStartTimer = window.setTimeout(playNextBeat, beatDuration * 1000);
      } else {
        // 카운트인 완료 - 영상 시작 및 루프 활성화
        this.handleTimerCountInComplete(segment, onComplete);
      }
    };

    // 첫 박 즉시 재생
    playNextBeat();
  }

  /**
   * 타이머 기반 카운트인 완료 후 처리
   */
  private handleTimerCountInComplete(segment: LoopSegment, onComplete: () => void): void {
    // 최신 segment 정보 다시 가져오기
    const latestSegment = this.profile.segments.find(s => s.id === segment.id);
    if (!latestSegment) {
      this.resetCountInState();
      return;
    }

    console.log('[Count-In] 타이머 모드 완료, 루프 활성화');

    // 루프 활성화
    this.setActive(latestSegment.id);

    // 메트로놈 설정 및 시작
    if (latestSegment.metronomeEnabled) {
      const effectiveSync = this.getEffectiveSync(latestSegment);
      if (effectiveSync.tempo && effectiveSync.timeSignature) {
        const loopDuration = latestSegment.end - latestSegment.start;
        this.metronome.start(
          effectiveSync.tempo,
          effectiveSync.timeSignature,
          latestSegment.start,
          loopDuration
        );
      }
    }

    // 영상 재생 시작
    this.video.currentTime = latestSegment.start;
    this.video.play().catch(err => console.error('[Count-In] 영상 재생 실패:', err));

    onComplete();
    this.resetCountInState();
  }

  /**
   * 카운트인 취소
   * @param pauseVideo 영상도 정지할지 여부 (기본: true)
   */
  cancelCountIn(pauseVideo: boolean = true): void {
    if (!this.countInActive) return;

    console.log('[Count-In] 취소 요청');

    // 메트로놈 중지 및 콜백 제거
    this.metronome.stop();
    this.metronome.setOnBeatCallback(null);

    // 타이머 취소 (Case 2)
    if (this.countInVideoStartTimer !== null) {
      clearTimeout(this.countInVideoStartTimer);
      this.countInVideoStartTimer = null;
    }

    // timeupdate 핸들러 제거 (Case 1)
    if (this.countInTimeUpdateHandler) {
      this.video.removeEventListener('timeupdate', this.countInTimeUpdateHandler);
      this.countInTimeUpdateHandler = null;
    }

    // 영상 정지 (옵션)
    if (pauseVideo) {
      this.video.pause();
    }

    this.resetCountInState();
  }

  /**
   * 하이브리드 모드에서 segment.start 도달 여부 확인
   * timeupdate 이벤트에서 호출됨 (백업용)
   */
  private checkCountInComplete(segmentId: string): void {
    if (!this.countInActive || this.countInTargetSegmentStart === null) {
      return;
    }

    const currentTime = this.video.currentTime;

    // segment.start에 도달했는지 확인 (약간의 허용 오차)
    // 참고: 일반적으로 메트로놈 콜백에서 completeCountIn이 먼저 호출됨
    if (currentTime >= this.countInTargetSegmentStart - 0.05) {
      this.completeCountIn(segmentId);
    }
  }

  /**
   * 카운트인 완료 처리
   * 메트로놈 콜백 또는 timeupdate에서 호출됨
   */
  private completeCountIn(segmentId: string): void {
    if (!this.countInActive) {
      return;
    }

    // 현재 프로필에서 세그먼트 정보를 가져와서 metronomeEnabled 확인
    const segment = this.profile.segments.find(s => s.id === segmentId);
    // 세그먼트별 메트로놈 설정 또는 글로벌 메트로놈 설정 확인
    const segmentMetronomeEnabled = segment?.metronomeEnabled || false;
    const shouldContinueMetronome = segmentMetronomeEnabled || this.globalSyncMetronomeActive;

    console.log('[Count-In] 완료, 루프 활성화:', {
      segmentId,
      segmentMetronomeEnabled,
      globalSyncMetronomeActive: this.globalSyncMetronomeActive,
      shouldContinueMetronome
    });

    // timeupdate 핸들러 제거
    if (this.countInTimeUpdateHandler) {
      this.video.removeEventListener('timeupdate', this.countInTimeUpdateHandler);
      this.countInTimeUpdateHandler = null;
    }

    // 카운트인 UI 콜백 제거 후 메트로놈 비트 콜백 복원
    if (shouldContinueMetronome && this.metronomeBeatCallback) {
      // 메트로놈이 계속 재생되고 비트 콜백이 설정되어 있으면 복원
      const callback = this.metronomeBeatCallback;
      this.metronome.setOnBeatCallback((beatNumber, beatsPerBar) => {
        callback(beatNumber, beatsPerBar);
        return true; // 클릭음 재생
      });
    } else {
      this.metronome.setOnBeatCallback(null);
    }

    // 루프 활성화
    this.setActive(segmentId);

    // 메트로놈 처리: 세그먼트 또는 글로벌 메트로놈이 활성화되어 있으면 계속 재생
    if (!shouldContinueMetronome) {
      this.metronome.stop();
    }
    // shouldContinueMetronome이 true면 메트로놈은 계속 재생 (이미 시작됨)

    // 완료 콜백 호출
    if (this.countInOnComplete) {
      this.countInOnComplete();
    }

    // 상태 초기화
    this.resetCountInState();
  }

  /**
   * 카운트인 상태 초기화
   */
  private resetCountInState(): void {
    this.countInActive = false;
    this.countInVideoStartTimer = null;
    this.countInTargetSegmentStart = null;
    this.countInOnComplete = null;

    // timeupdate 핸들러가 남아있으면 제거
    if (this.countInTimeUpdateHandler) {
      this.video.removeEventListener('timeupdate', this.countInTimeUpdateHandler);
      this.countInTimeUpdateHandler = null;
    }

    this.metronome.setOnBeatCallback(null);
  }

  /**
   * 카운트인 활성화 상태 확인
   */
  isCountInActive(): boolean {
    return this.countInActive;
  }

  /**
   * 글로벌 싱크 메트로놈 활성화 상태 확인
   */
  isGlobalSyncMetronomeActive(): boolean {
    return this.globalSyncMetronomeActive;
  }

  /**
   * 리소스 정리
   */
  dispose(): void {
    // 카운트인 취소
    this.cancelCountIn();

    // 메트로놈 루프 범위 해제 및 정지
    this.metronome.clearLoopRange();
    this.globalSyncMetronomeActive = false;
    this.metronome.stop();
    this.metronome.dispose();
  }
} 