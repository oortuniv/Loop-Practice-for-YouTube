import { parseTimeSignature } from '../../utils';

/**
 * 메트로놈 클래스
 * Web Audio API를 사용하여 정확한 타이밍의 클릭음 생성
 * Look-ahead 스케줄링으로 100ms 앞서 스케줄, 25ms마다 체크
 */
export class Metronome {
  private audioContext: AudioContext | null = null;
  private schedulerTimer: number | null = null;
  private nextBeatTime: number = 0;
  private currentBeat: number = 0;
  private bpm: number = 120;
  private beatsPerBar: number = 4;
  private isPlaying: boolean = false;

  // Look-ahead 설정
  private readonly SCHEDULE_AHEAD_TIME = 0.1; // 100ms 앞서 스케줄
  private readonly SCHEDULER_INTERVAL = 25; // 25ms마다 체크

  // 클릭음 설정 (메트로놈 임시 비활성화로 현재 미사용)
  // private readonly DOWNBEAT_FREQUENCY = 800; // 첫 박 (낮은 음)
  // private readonly BEAT_FREQUENCY = 1200; // 다른 박 (높은 음)
  // private readonly DOWNBEAT_VOLUME = 0.5; // 첫 박 볼륨
  // private readonly BEAT_VOLUME = 0.3; // 다른 박 볼륨
  // private readonly CLICK_DURATION = 0.05; // 50ms

  // 클릭음 시간 캐싱
  private cachedBeats: Array<{ time: number; beatNumber: number }> = [];
  private cacheKey: string = '';
  private loopDuration: number = 0;

  constructor() {
    // AudioContext는 start 시점에 생성 (사용자 상호작용 필요)
  }

  /**
   * 메트로놈 시작
   * @param bpm BPM (beats per minute)
   * @param timeSignature 박자표 (예: "4/4")
   * @param startOffset 시작 오프셋 (초 단위, 비디오 currentTime)
   * @param loopDuration 루프 길이 (초 단위, 옵션)
   */
  start(bpm: number, timeSignature: string, startOffset: number = 0, loopDuration?: number): void {
    console.log('[Metronome] start() 호출:', { bpm, timeSignature, startOffset, loopDuration });

    if (this.isPlaying) {
      console.log('[Metronome] 이미 재생 중, 중지 후 재시작');
      this.stop();
    }

    // AudioContext 초기화
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
      console.log('[Metronome] AudioContext 생성:', this.audioContext.state);
    } else {
      console.log('[Metronome] 기존 AudioContext 사용:', this.audioContext.state);
    }

    this.bpm = bpm;
    const [beatsPerBar] = parseTimeSignature(timeSignature);
    this.beatsPerBar = beatsPerBar;

    // 캐시 키 생성 (bpm, timeSignature, loopDuration으로 고유 식별)
    const newCacheKey = `${bpm}-${timeSignature}-${loopDuration || 0}`;

    // 캐시가 유효하지 않으면 재계산
    if (newCacheKey !== this.cacheKey || this.cachedBeats.length === 0) {
      console.log('[Metronome] 클릭음 시간 캐시 생성 중...');
      this.cacheKey = newCacheKey;
      this.loopDuration = loopDuration || 0;
      this.generateBeatCache();
    } else {
      console.log('[Metronome] 캐시된 클릭음 시간 사용');
    }

    // 시작 오프셋 기반으로 현재 beat 계산
    this.currentBeat = this.calculateBeatOffset(startOffset);

    // 첫 번째 beat 시간 설정 (AudioContext 시간 기준)
    this.nextBeatTime = this.audioContext.currentTime;

    this.isPlaying = true;

    console.log('[Metronome] 메트로놈 시작됨:', {
      bpm: this.bpm,
      beatsPerBar: this.beatsPerBar,
      currentBeat: this.currentBeat,
      nextBeatTime: this.nextBeatTime,
      audioContextTime: this.audioContext.currentTime,
      cachedBeatsCount: this.cachedBeats.length
    });

    // 스케줄러 시작
    this.schedulerTimer = window.setInterval(() => {
      this.scheduler();
    }, this.SCHEDULER_INTERVAL);
  }

  /**
   * 메트로놈 중지
   */
  stop(): void {
    this.isPlaying = false;

    if (this.schedulerTimer !== null) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }

    // AudioContext는 재사용을 위해 유지 (close하지 않음)
  }

  /**
   * 현재 재생 중인지 여부
   */
  isRunning(): boolean {
    return this.isPlaying;
  }

  /**
   * 비디오 시간 기반으로 beat 오프셋 계산
   * @param videoTime 비디오 currentTime (초)
   * @returns 현재 beat 번호 (0부터 시작)
   */
  calculateBeatOffset(videoTime: number): number {
    const beatDuration = 60 / this.bpm;
    const totalBeats = videoTime / beatDuration;
    // 마디 내에서의 beat 위치 (0 ~ beatsPerBar-1)
    return Math.floor(totalBeats % this.beatsPerBar);
  }

  /**
   * Beat를 다시 동기화 (loop 점프 시 사용)
   * @param videoTime 새로운 비디오 currentTime (초)
   */
  resync(videoTime: number): void {
    if (!this.isPlaying || !this.audioContext) {
      return;
    }

    // 현재 beat 재계산
    this.currentBeat = this.calculateBeatOffset(videoTime);

    // 다음 beat 시간을 현재 시간으로 재설정
    this.nextBeatTime = this.audioContext.currentTime;
  }

  /**
   * Look-ahead 스케줄러
   * 현재 시간부터 SCHEDULE_AHEAD_TIME까지의 beat들을 스케줄링
   */
  private scheduler(): void {
    if (!this.audioContext || !this.isPlaying) {
      return;
    }

    const currentTime = this.audioContext.currentTime;

    // Look-ahead 윈도우 내의 모든 beat 스케줄
    let scheduledCount = 0;
    while (this.nextBeatTime < currentTime + this.SCHEDULE_AHEAD_TIME) {
      this.scheduleClick(this.nextBeatTime, this.currentBeat);
      scheduledCount++;

      // 다음 beat 계산
      const beatDuration = 60 / this.bpm;
      this.nextBeatTime += beatDuration;
      this.currentBeat = (this.currentBeat + 1) % this.beatsPerBar;
    }

    if (scheduledCount > 0) {
      console.log(`[Metronome] 스케줄링됨: ${scheduledCount}개 beat, 다음 beat 시간: ${this.nextBeatTime.toFixed(3)}`);
    }
  }

  /**
   * 개별 클릭음 스케줄링
   * @param _when 재생 시간 (AudioContext.currentTime 기준)
   * @param _beatNumber 현재 beat 번호 (0 = 첫 박)
   *
   * 임시 비활성화: 메트로놈 기능이 의도대로 동작하지 않아 소리 재생 중단
   */
  private scheduleClick(_when: number, _beatNumber: number): void {
    // 메트로놈 소리 재생 비활성화 (로직은 유지)
    return;

    /* 원본 로직 보존 (향후 재활성화 대비)
    if (!this.audioContext) {
      console.warn('[Metronome] scheduleClick: AudioContext가 없음');
      return;
    }

    // 첫 박 여부에 따라 음높이와 볼륨 결정
    const isDownbeat = beatNumber === 0;
    const frequency = isDownbeat ? this.DOWNBEAT_FREQUENCY : this.BEAT_FREQUENCY;
    const volume = isDownbeat ? this.DOWNBEAT_VOLUME : this.BEAT_VOLUME;

    console.log(`[Metronome] 클릭음 스케줄링: beat=${beatNumber}, when=${when.toFixed(3)}, freq=${frequency}Hz, vol=${volume}, isDownbeat=${isDownbeat}`);

    // Oscillator 생성 (sine wave)
    const osc = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    osc.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    osc.frequency.value = frequency;

    // 엔벨로프: 빠르게 시작 → 빠르게 페이드아웃
    gainNode.gain.setValueAtTime(volume, when);
    gainNode.gain.exponentialRampToValueAtTime(0.01, when + this.CLICK_DURATION);

    osc.start(when);
    osc.stop(when + this.CLICK_DURATION);
    */
  }

  /**
   * 리소스 정리 (컴포넌트 unmount 시 호출)
   */
  dispose(): void {
    this.stop();

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    // 캐시 초기화
    this.cachedBeats = [];
    this.cacheKey = '';
  }

  /**
   * Beat 시간 캐시 생성
   * 루프 전체에 대한 beat 시간들을 미리 계산
   */
  private generateBeatCache(): void {
    this.cachedBeats = [];

    if (!this.bpm || !this.beatsPerBar) {
      console.warn('[Metronome] generateBeatCache: BPM 또는 beatsPerBar가 설정되지 않음');
      return;
    }

    const beatDuration = 60 / this.bpm; // 초 단위

    // loopDuration이 있으면 그 구간에 대해서만 계산, 없으면 최대 60초
    const maxDuration = this.loopDuration > 0 ? this.loopDuration : 60;
    const totalBeats = Math.ceil(maxDuration / beatDuration);

    for (let i = 0; i < totalBeats; i++) {
      const time = i * beatDuration;
      const beatNumber = i % this.beatsPerBar;

      this.cachedBeats.push({ time, beatNumber });
    }

    console.log(`[Metronome] Beat 캐시 생성 완료: ${this.cachedBeats.length}개 beats, duration=${maxDuration.toFixed(2)}s`);
  }
}
