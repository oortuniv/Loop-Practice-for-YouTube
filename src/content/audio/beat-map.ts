/**
 * Beat 인터페이스: 단일 비트 정보
 */
export interface Beat {
  videoTime: number;      // 비디오 기준 비트 시간
  beatNumber: number;     // 마디 내 박 번호 (1부터)
  beatIndex: number;      // 전체 인덱스 (0부터)
  isDownbeat: boolean;    // 첫 박 여부
}

/**
 * BeatMap: 비트 시간 사전 계산 및 저장
 *
 * 역할:
 * - Beat Sync 완료 시 전체 비디오의 비트 시간을 미리 계산
 * - 메트로놈 활성화 여부와 관계없이 항상 준비
 * - 루프 범위 내 비트 조회 지원
 *
 * 사용처:
 * - LoopController: 스케줄링 시 비트 조회
 * - Quantize: 구간 경계를 비트에 맞춤
 */
export class BeatMap {
  private beats: Beat[] = [];
  readonly bpm: number;
  readonly beatsPerBar: number;
  readonly beatOffset: number;
  readonly beatDuration: number;

  constructor(bpm: number, beatOffset: number, beatsPerBar: number, videoDuration: number) {
    this.bpm = bpm;
    this.beatOffset = beatOffset;
    this.beatsPerBar = beatsPerBar;
    this.beatDuration = 60 / bpm;
    this.compute(videoDuration);

    console.log(`[BeatMap] 생성: bpm=${bpm}, offset=${beatOffset.toFixed(3)}, beatsPerBar=${beatsPerBar}, beats=${this.beats.length}개`);
  }

  /**
   * 전체 비디오의 비트 시간 계산
   * beatOffset 이전의 비트도 역으로 계산하여 0초부터 시작하는 루프에서도 정확한 비트 재생 지원
   */
  private compute(videoDuration: number): void {
    this.beats = [];

    // 1. beatOffset 이전의 비트 계산 (역방향)
    // 예: offset=3, beatDuration=0.5 → 2.5, 2.0, 1.5, 1.0, 0.5, 0.0 순으로 계산
    const beatsBeforeOffset: Beat[] = [];
    let negativeIndex = -1;

    for (let time = this.beatOffset - this.beatDuration; time >= 0; time -= this.beatDuration) {
      // 음수 인덱스를 사용하여 beatNumber 계산
      // offset 직전 비트는 이전 마디의 마지막 박이어야 함
      // beatsPerBar=4: negativeIndex=-1 → beatNumber=4, -2 → 3, -3 → 2, -4 → 1
      // 공식: ((negativeIndex % beatsPerBar) + beatsPerBar) % beatsPerBar 후,
      //       0이면 beatsPerBar, 아니면 그 값 → 이건 1,2,3,0 패턴을 4,3,2,1로 변환 필요
      // 수정된 공식: beatsPerBar - ((-negativeIndex - 1) % beatsPerBar)
      const distanceFromOffset = -negativeIndex; // 1, 2, 3, 4, ...
      const beatNumber = this.beatsPerBar - ((distanceFromOffset - 1) % this.beatsPerBar);

      beatsBeforeOffset.unshift({
        videoTime: time,
        beatNumber,
        beatIndex: negativeIndex,
        isDownbeat: beatNumber === 1
      });
      negativeIndex--;
    }

    // 2. beatOffset부터 비디오 끝까지 비트 계산 (정방향)
    let beatIndex = 0;
    for (let time = this.beatOffset; time < videoDuration; time += this.beatDuration) {
      const beatNumber = (beatIndex % this.beatsPerBar) + 1;
      this.beats.push({
        videoTime: time,
        beatNumber,
        beatIndex,
        isDownbeat: beatNumber === 1
      });
      beatIndex++;
    }

    // 3. 앞에 삽입 (beatOffset 이전 비트들)
    this.beats = [...beatsBeforeOffset, ...this.beats];

    console.log(`[BeatMap] 계산 완료: offset=${this.beatOffset.toFixed(3)}, beforeOffset=${beatsBeforeOffset.length}개, total=${this.beats.length}개`);
  }

  /**
   * 특정 범위 내 비트 조회 (루프 구간용)
   * @param start 시작 시간 (포함)
   * @param end 종료 시간 (미포함)
   * @param tolerance 허용 오차 (기본 50ms) - 이 시간 이내로 지난 비트도 포함
   */
  getBeatsInRange(start: number, end: number, tolerance: number = 0.050): Beat[] {
    // tolerance를 적용하여 약간 지난 비트도 포함
    // 예: start=0.021, tolerance=0.050이면 실제로 -0.029 이후의 비트를 조회
    const adjustedStart = start - tolerance;

    // 이진 검색으로 시작 인덱스 찾기
    const startIdx = this.findFirstBeatIndexAfter(adjustedStart);
    if (startIdx === -1) return [];

    const result: Beat[] = [];
    for (let i = startIdx; i < this.beats.length; i++) {
      const beat = this.beats[i];
      if (beat.videoTime >= end) break;
      result.push(beat);
    }
    return result;
  }

  /**
   * 특정 시간 이후 첫 비트 조회
   */
  getNextBeat(videoTime: number): Beat | null {
    const idx = this.findFirstBeatIndexAfter(videoTime);
    return idx !== -1 ? this.beats[idx] : null;
  }

  /**
   * 특정 시간 이전 마지막 비트 조회
   */
  getLastBeatBefore(videoTime: number): Beat | null {
    const idx = this.findLastBeatIndexBefore(videoTime);
    return idx !== -1 ? this.beats[idx] : null;
  }

  /**
   * 특정 시간의 비트 인덱스 조회 (해당 시간을 포함하는 비트)
   */
  getBeatIndexAt(videoTime: number): number {
    const idx = this.findLastBeatIndexBefore(videoTime + 0.001); // 약간의 여유
    return idx !== -1 ? this.beats[idx].beatIndex : -1;
  }

  /**
   * 전체 비트 배열 반환 (디버깅/테스트용)
   */
  getAllBeats(): Beat[] {
    return [...this.beats];
  }

  /**
   * 비트 개수 반환
   */
  get length(): number {
    return this.beats.length;
  }

  /**
   * 이진 검색: 특정 시간 이후 첫 비트 인덱스
   */
  private findFirstBeatIndexAfter(time: number): number {
    if (this.beats.length === 0) return -1;

    let left = 0;
    let right = this.beats.length;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (this.beats[mid].videoTime < time) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    return left < this.beats.length ? left : -1;
  }

  /**
   * 이진 검색: 특정 시간 이전 마지막 비트 인덱스
   */
  private findLastBeatIndexBefore(time: number): number {
    if (this.beats.length === 0) return -1;

    let left = 0;
    let right = this.beats.length;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (this.beats[mid].videoTime <= time) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    return left > 0 ? left - 1 : -1;
  }
}
