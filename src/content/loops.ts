import { LoopSegment, VideoProfile } from '../types';
import { throttle } from '../utils';

export class LoopController {
  private video: HTMLVideoElement;
  private profile: VideoProfile;
  private active?: LoopSegment;
  private tickThrottled: () => void;

  constructor(video: HTMLVideoElement, profile: VideoProfile) {
    this.video = video;
    this.profile = profile;
    this.tickThrottled = throttle(() => this.tick(), 50); // 100ms → 50ms로 단축
    
    // 초기 활성 구간 설정
    if (profile.activeSegmentId) {
      this.setActive(profile.activeSegmentId);
    }
  }

  setProfile(profile: VideoProfile): void {
    this.profile = profile;
    console.log('LoopController setProfile:', {
      activeSegmentId: profile.activeSegmentId,
      segmentsCount: profile.segments.length
    });
    // 활성 구간 상태도 함께 업데이트
    this.setActive(profile.activeSegmentId);
  }

  setActive(id?: string | null): void {
    this.profile.activeSegmentId = id ?? null;
    this.active = this.profile.segments.find(s => s.id === id) || undefined;
    this.applyActiveRate();
    
    // 디버깅 로그
    if (this.active) {
      console.log(`루프 활성화: ${this.active.label} (${this.active.start}s ~ ${this.active.end}s)`);
    } else {
      console.log('루프 비활성화');
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
      console.log('루프 체크: 활성 구간 없음');
      return;
    }
    
    const { start, end } = this.active;
    const currentTime = this.video.currentTime;
    
    // currentTime이 유효하지 않은 경우 처리 (더 엄격한 검사)
    if (currentTime === undefined || currentTime === null || isNaN(currentTime) || typeof currentTime !== 'number') {
      console.log('루프 체크: currentTime이 유효하지 않음', currentTime);
      return;
    }
    
    // 디버깅: 루프 상태 로그 (실제 환경에서는 제거)
    if (process.env.NODE_ENV === 'development') {
      console.log(`루프 체크: 현재시간=${currentTime.toFixed(2)}s, 구간=${start}s~${end}s, 활성=${this.active.label}`);
    }
    
    // end 지점에 도달하면 start로 점프 (더 정확한 조건)
    if (currentTime >= end) {
      console.log(`루프 점프: ${currentTime.toFixed(2)}s → ${start.toFixed(2)}s`);
      this.video.currentTime = start;
      
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
      if (next) {
        this.video.currentTime = next.start;
      }
    } else {
      // 이전 구간: 현재 시간보다 작은 start 중 최대값
      const prev = [...segments].reverse().find(s => s.start < currentTime) ?? segments[segments.length - 1];
      this.setActive(prev?.id);
      if (prev) {
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
      // 현재 시간을 start로 하는 새 구간 생성
      const endTime = Math.min(currentTime + 10, this.video.duration);
      
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
        end: endTime, // 기본 10초 구간
        rate: safeDefaultRate,
        label: finalLabel
      };
      
      this.profile.segments.push(newSegment);
      return newSegment;
    } else {
      // 마지막 구간의 end를 현재 시간으로 설정
      const lastSegment = this.profile.segments[this.profile.segments.length - 1];
      if (lastSegment && lastSegment.start < currentTime) {
        lastSegment.end = currentTime;
        
        // 라벨이 비어있으면 시작 시간 ~ 끝 시간으로 업데이트
        if (!lastSegment.label || lastSegment.label.startsWith('구간 ')) {
          const startMins = Math.floor(lastSegment.start / 60);
          const startSecs = Math.floor(lastSegment.start % 60);
          const endMins = Math.floor(currentTime / 60);
          const endSecs = Math.floor(currentTime % 60);
          lastSegment.label = `${startMins}:${startSecs.toString().padStart(2, '0')}~${endMins}:${endSecs.toString().padStart(2, '0')}`;
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
    
    Object.assign(segment, updates);
    
    // 활성 구간이 업데이트된 경우 속도 재적용
    if (this.active?.id === id) {
      this.applyActiveRate();
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
} 