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

  constructor(video: HTMLVideoElement, profile: VideoProfile) {
    this.video = video;
    this.profile = profile;
    this.tickThrottled = throttle(() => this.tick(), 50); // 100ms → 50ms로 단축
    this.metronome = new Metronome();

    // 초기 활성 구간 설정
    if (profile.activeSegmentId) {
      this.setActive(profile.activeSegmentId);
    }

    // 비디오 일시정지 시 메트로놈 중지 (플래그는 유지)
    this.video.addEventListener('pause', () => {
      if (this.metronome.isRunning()) {
        // 소리만 멈추고 플래그는 유지 (재생 시 다시 시작하기 위해)
        this.metronome.stop();
      }
    });

    // 비디오 재생 시 메트로놈 재시작
    this.video.addEventListener('play', () => {
      if (this.globalSyncMetronomeActive) {
        this.startGlobalSyncMetronome();
      } else if (this.active?.metronomeEnabled) {
        this.startMetronome();
      }
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

    // 메트로놈 처리
    if (this.active) {
      console.log(`루프 활성화: ${this.active.label} (${this.active.start}s ~ ${this.active.end}s)`);

      // 메트로놈이 활성화되어 있고 비디오가 재생 중이면 재시작
      if (this.active.metronomeEnabled && !this.video.paused) {
        this.stopMetronome();
        this.startMetronome();
      }
    } else {
      console.log('루프 비활성화');

      // 루프 비활성화 시 메트로놈 중지
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

    // 디버깅: 루프 상태 로그 (실제 환경에서는 제거)
    if (process.env.NODE_ENV === 'development') {
      console.log(`루프 체크: 현재시간=${currentTime.toFixed(2)}s, 구간=${start}s~${end}s, 활성=${latestSegment.label}`);
    }

    // end 지점에 도달하면 start로 점프 (더 정확한 조건)
    if (currentTime >= end) {
      console.log(`루프 점프: ${currentTime.toFixed(2)}s → ${start.toFixed(2)}s`);
      this.video.currentTime = start;

      // 메트로놈 재동기화 (루프 점프 시)
      // start 지점부터 beat 0으로 재시작
      if (latestSegment.metronomeEnabled && this.metronome.isRunning()) {
        this.stopMetronome();
        this.startMetronome();
      }

      // 재생 중이 아니면 재생 시작
      if (this.video.paused) {
        console.log('루프 점프 후 재생 시작');
        this.video.play().catch((error) => {
          console.error('루프 점프 후 재생 실패:', error);
        });
      }
    }
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
   * 메트로놈 시작
   */
  private startMetronome(): void {
    if (!this.active || !this.profile.tempo || !this.profile.timeSignature) {
      console.log('메트로놈 시작 실패: BPM 또는 박자표 미설정');
      return;
    }

    // 글로벌 오프셋 적용
    const globalOffset = this.profile.globalMetronomeOffset || 0;

    // 비디오의 절대 시간에서 글로벌 오프셋을 빼서 메트로놈 시작 시간 계산
    // 예: 비디오 2.323s, 글로벌 오프셋 2.323s → 메트로놈은 0s부터 시작 (첫 박)
    const startOffset = this.video.currentTime - globalOffset;
    const loopDuration = this.active.end - this.active.start;

    this.metronome.start(
      this.profile.tempo,
      this.profile.timeSignature,
      startOffset,
      loopDuration
    );

    console.log('메트로놈 시작:', {
      bpm: this.profile.tempo,
      timeSignature: this.profile.timeSignature,
      videoCurrentTime: this.video.currentTime,
      globalOffset,
      startOffset,
      loopDuration
    });
  }

  /**
   * 메트로놈 중지
   */
  private stopMetronome(): void {
    this.metronome.stop();
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

    // 글로벌 오프셋 적용
    const globalOffset = this.profile.globalMetronomeOffset || 0;
    const startOffset = this.video.currentTime - globalOffset;

    // 루프 길이 없이 메트로놈 시작 (무한 재생)
    this.metronome.start(
      this.profile.tempo,
      this.profile.timeSignature,
      startOffset
    );

    console.log('[Global Sync Metronome] 시작:', {
      bpm: this.profile.tempo,
      timeSignature: this.profile.timeSignature,
      videoCurrentTime: this.video.currentTime,
      globalOffset,
      startOffset
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
   * 리소스 정리
   */
  dispose(): void {
    // 메트로놈 정지 및 리소스 정리
    this.globalSyncMetronomeActive = false;
    this.metronome.stop();
    this.metronome.dispose();
  }
} 