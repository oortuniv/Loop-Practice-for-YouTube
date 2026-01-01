import { parseTimeSignature } from '../../utils';

/**
 * 메트로놈 클래스
 * Web Audio API를 사용하여 나무 메트로놈 스타일의 클릭음 생성
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

  // 클릭음 시간 캐싱
  private cachedBeats: Array<{ time: number; beatNumber: number }> = [];
  private cacheKey: string = '';
  private loopDuration: number = 0;

  // 볼륨 설정 (0.0 ~ 1.0, 실제 출력은 MAX_VOLUME을 곱함)
  private volume: number = 0.9;
  // 최대 볼륨 승수 (YouTube 볼륨과 비슷한 수준으로 설정)
  private readonly MAX_VOLUME = 4.0;

  constructor() {
    // AudioContext는 start 시점에 생성 (사용자 상호작용 필요)
  }

  /**
   * 메트로놈 볼륨 설정
   * @param volume 볼륨 (0.0 ~ 1.0)
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  /**
   * 현재 볼륨 가져오기
   */
  getVolume(): number {
    return this.volume;
  }

  /**
   * AudioContext를 가져오거나 생성합니다.
   */
  getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    return this.audioContext;
  }

  /**
   * 메트로놈 시작
   * @param bpm BPM (beats per minute)
   * @param timeSignature 박자표 (예: "4/4")
   * @param startOffset 시작 오프셋 (초 단위, 비디오 currentTime - globalMetronomeOffset)
   * @param loopDuration 루프 길이 (초 단위, 옵션)
   */
  start(bpm: number, timeSignature: string, startOffset: number = 0, loopDuration?: number): void {
    console.log('[Metronome] start() 호출:', { bpm, timeSignature, startOffset, loopDuration });

    if (this.isPlaying) {
      console.log('[Metronome] 이미 재생 중, 중지 후 재시작');
      this.stop();
    }

    // AudioContext 초기화
    const ctx = this.getAudioContext();
    console.log('[Metronome] AudioContext 상태:', ctx.state);

    // suspended 상태면 resume
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    this.bpm = bpm;
    const [beatsPerBar] = parseTimeSignature(timeSignature);
    this.beatsPerBar = beatsPerBar;

    // 캐시 키 생성 (bpm, timeSignature, loopDuration으로 고유 식별)
    const newCacheKey = `${bpm}-${timeSignature}-${loopDuration || 0}`;

    // 캐시가 유효하지 않으면 재계산
    if (newCacheKey !== this.cacheKey || this.cachedBeats.length === 0) {
      this.cacheKey = newCacheKey;
      this.loopDuration = loopDuration || 0;
      this.generateBeatCache();
    }

    // beat 계산 관련 상수
    const beatDuration = 60 / this.bpm;
    const totalBeats = startOffset / beatDuration;
    const beatProgress = totalBeats - Math.floor(totalBeats); // 0~1 사이의 진행률

    // 현재 시점에서 다음에 재생할 beat 번호 계산
    // beatProgress가 0.01 미만이면 정확히 beat 경계에 있는 것으로 간주
    const isOnBeatBoundary = beatProgress < 0.01 || beatProgress > 0.99;
    let timeToNextBeat: number;

    if (isOnBeatBoundary) {
      // beat 경계에 있으면 현재 beat부터 시작
      this.currentBeat = Math.round(totalBeats) % this.beatsPerBar;
      this.nextBeatTime = ctx.currentTime; // 즉시 재생
      timeToNextBeat = 0;
    } else {
      // beat 중간에 있으면 다음 beat까지 대기
      this.currentBeat = Math.ceil(totalBeats) % this.beatsPerBar;
      timeToNextBeat = (1 - beatProgress) * beatDuration;
      this.nextBeatTime = ctx.currentTime + timeToNextBeat;
    }

    this.isPlaying = true;

    console.log('[Metronome] 메트로놈 시작됨:', {
      bpm: this.bpm,
      beatsPerBar: this.beatsPerBar,
      currentBeat: this.currentBeat,
      nextBeatTime: this.nextBeatTime,
      timeToNextBeat
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
  }

  /**
   * 현재 재생 중인지 여부
   */
  isRunning(): boolean {
    return this.isPlaying;
  }

  /**
   * 비디오 시간 기반으로 다음에 재생할 beat 번호 계산
   * @param videoTime 비디오 currentTime - globalMetronomeOffset (초)
   * @returns 다음에 재생할 beat 번호 (0부터 시작, 0=1박/downbeat)
   */
  calculateBeatOffset(videoTime: number): number {
    const beatDuration = 60 / this.bpm;
    const totalBeats = videoTime / beatDuration;
    // 다음에 재생할 beat 번호 (현재 beat + 1)
    // ceil을 사용하여 다음 beat를 가리키도록 함
    // 예: 8.4 beats → ceil(8.4) = 9 → 9 % 4 = 1 (2번째 박)
    // 예: 8.0 beats (정확히 beat 경계) → ceil(8.0) = 8 → 8 % 4 = 0 (1번째 박)
    return Math.ceil(totalBeats) % this.beatsPerBar;
  }

  /**
   * Beat를 다시 동기화 (loop 점프 시 사용)
   * @param videoTime 새로운 비디오 currentTime - globalMetronomeOffset (초)
   */
  resync(videoTime: number): void {
    if (!this.isPlaying || !this.audioContext) {
      return;
    }

    // beat 계산 관련 상수
    const beatDuration = 60 / this.bpm;
    const totalBeats = videoTime / beatDuration;
    const beatProgress = totalBeats - Math.floor(totalBeats); // 0~1 사이의 진행률

    // beat 경계 판단 (0.01 = 1% 허용 오차)
    const isOnBeatBoundary = beatProgress < 0.01 || beatProgress > 0.99;

    if (isOnBeatBoundary) {
      // beat 경계에 있으면 현재 beat부터 시작
      this.currentBeat = Math.round(totalBeats) % this.beatsPerBar;
      this.nextBeatTime = this.audioContext.currentTime;
    } else {
      // beat 중간에 있으면 다음 beat까지 대기
      this.currentBeat = Math.ceil(totalBeats) % this.beatsPerBar;
      const timeToNextBeat = (1 - beatProgress) * beatDuration;
      this.nextBeatTime = this.audioContext.currentTime + timeToNextBeat;
    }
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
    while (this.nextBeatTime < currentTime + this.SCHEDULE_AHEAD_TIME) {
      this.scheduleClick(this.nextBeatTime, this.currentBeat);

      // 다음 beat 계산
      const beatDuration = 60 / this.bpm;
      this.nextBeatTime += beatDuration;
      this.currentBeat = (this.currentBeat + 1) % this.beatsPerBar;
    }
  }

  /**
   * 나무 메트로놈 스타일의 클릭음을 스케줄링합니다.
   * 화이트 노이즈 + 필터로 "틱" 소리 생성
   */
  private scheduleClick(when: number, beatNumber: number): void {
    if (!this.audioContext) {
      return;
    }

    const isDownbeat = beatNumber === 0;
    this.playWoodClick(this.audioContext, when, isDownbeat);
  }

  /**
   * 나무 메트로놈 클릭음을 재생합니다.
   * @param ctx AudioContext
   * @param when 재생 시간
   * @param isDownbeat 첫 박 여부
   */
  private playWoodClick(ctx: AudioContext, when: number, isDownbeat: boolean): void {
    // 기본 볼륨에 전역 볼륨과 MAX_VOLUME을 곱함
    const baseVolume = isDownbeat ? 1.0 : 0.6;
    const finalVolume = baseVolume * this.volume * this.MAX_VOLUME;
    const pitchMultiplier = isDownbeat ? 1.0 : 1.3; // 첫 박은 낮은 음, 나머지는 높은 음

    // 1. 노이즈 버스트 생성 (짧은 화이트 노이즈)
    const noiseBuffer = this.createNoiseBuffer(ctx, 0.02); // 20ms
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    // 2. 밴드패스 필터 (나무 특성 주파수)
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 1800 * pitchMultiplier; // 첫 박: 1800Hz, 다른 박: 2340Hz
    bandpass.Q.value = 2;

    // 3. 하이패스 필터 (저음 제거)
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 400;

    // 4. 게인 엔벨로프
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, when);
    gainNode.gain.linearRampToValueAtTime(finalVolume, when + 0.001); // 1ms attack
    gainNode.gain.exponentialRampToValueAtTime(0.001, when + 0.025); // 25ms decay

    // 연결
    noiseSource.connect(bandpass);
    bandpass.connect(highpass);
    highpass.connect(gainNode);
    gainNode.connect(ctx.destination);

    // 재생
    noiseSource.start(when);
    noiseSource.stop(when + 0.03);

    // 5. 추가 톤 (나무 울림감)
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = isDownbeat ? 800 : 1000;

    oscGain.gain.setValueAtTime(0, when);
    oscGain.gain.linearRampToValueAtTime(finalVolume * 0.3, when + 0.001);
    oscGain.gain.exponentialRampToValueAtTime(0.001, when + 0.015);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);

    osc.start(when);
    osc.stop(when + 0.02);
  }

  /**
   * 화이트 노이즈 버퍼를 생성합니다.
   */
  private createNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const bufferSize = Math.ceil(sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    return buffer;
  }

  /**
   * 단일 클릭음을 즉시 재생합니다 (TAP Sync 피드백용).
   * 최소 레이턴시를 위해 ctx.currentTime을 직접 사용합니다.
   * @param isDownbeat 첫 박 여부
   */
  playClickNow(isDownbeat: boolean): void {
    const ctx = this.getAudioContext();

    // suspended 상태면 resume (비동기지만 즉시 재생 시도)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // 즉시 재생 (ctx.currentTime은 가장 빠른 재생 시점)
    this.playWoodClick(ctx, ctx.currentTime, isDownbeat);
  }

  /**
   * AudioContext를 워밍업합니다.
   * 사용자 첫 상호작용 시 호출하면 이후 재생 레이턴시가 줄어듭니다.
   */
  warmup(): void {
    const ctx = this.getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
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

    console.log(`[Metronome] Beat 캐시 생성 완료: ${this.cachedBeats.length}개 beats`);
  }
}
