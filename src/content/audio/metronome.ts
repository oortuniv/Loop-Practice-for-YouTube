import { parseTimeSignature } from '../../utils';

/**
 * 메트로놈 클래스
 * Web Audio API를 사용하여 나무 메트로놈 스타일의 클릭음 생성
 * video.currentTime 기반으로 박 타이밍 계산
 */
export class Metronome {
  private audioContext: AudioContext | null = null;
  private schedulerTimer: number | null = null;
  private bpm: number = 120;
  private beatsPerBar: number = 4;
  private isPlaying: boolean = false;

  // video.currentTime 기반 스케줄링
  private video: HTMLVideoElement | null = null;
  private metronomeOffset: number = 0; // 글로벌 또는 로컬 오프셋 (첫 박 시간)
  private lastScheduledBeatIndex: number = -1; // 마지막으로 스케줄링한 박 인덱스
  private readonly POLL_INTERVAL = 10; // 10ms마다 체크

  // Look-ahead 스케줄링
  private readonly LOOK_AHEAD_TIME = 0.05; // 50ms 앞을 미리 스케줄링 (루프 점프 시 오버랩 최소화)
  private lastVideoTime: number = 0; // 마지막으로 확인한 video.currentTime
  private lastAudioContextTime: number = 0; // 마지막으로 확인한 AudioContext.currentTime
  private videoToAudioOffset: number = 0; // video.currentTime과 AudioContext.currentTime 간의 오프셋

  // 클릭음 시간 캐싱
  private cachedBeats: Array<{ time: number; beatNumber: number }> = [];
  private cacheKey: string = '';
  private loopDuration: number = 0;

  // 루프 범위 (end 이후의 박은 스케줄하지 않음)
  private loopEnd: number = Infinity;
  private loopStart: number = 0;

  // 루프 점프 요청 콜백 (메트로놈이 loopEnd 도달 감지 시 호출)
  private onLoopJumpRequest: ((start: number) => void) | null = null;

  // 볼륨 설정 (0.0 ~ 1.0, 실제 출력은 MAX_VOLUME을 곱함)
  private volume: number = 0.9;
  // 최대 볼륨 승수 (YouTube 볼륨과 비슷한 수준으로 설정)
  private readonly MAX_VOLUME = 4.0;

  // 박 콜백 (카운트인 UI 업데이트용)
  // 반환값이 false면 해당 박의 클릭음을 재생하지 않음
  private onBeatCallback: ((beatNumber: number, beatsPerBar: number) => boolean | void) | null = null;

  constructor() {
    // AudioContext는 start 시점에 생성 (사용자 상호작용 필요)
  }

  /**
   * 박 콜백 설정 (각 박마다 호출됨)
   * @param callback (beatNumber: 1부터 시작, beatsPerBar: 총 박 수)
   *                 반환값이 false면 해당 박의 클릭음을 재생하지 않음
   */
  setOnBeatCallback(callback: ((beatNumber: number, beatsPerBar: number) => boolean | void) | null): void {
    this.onBeatCallback = callback;
  }

  /**
   * 비디오 엘리먼트 설정
   */
  setVideo(video: HTMLVideoElement): void {
    this.video = video;
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
   * 루프 범위 설정 (end 이후의 박은 스케줄하지 않음)
   * @param start 루프 시작점 (초)
   * @param end 루프 끝점 (초)
   */
  setLoopRange(start: number, end: number): void {
    this.loopStart = start;
    this.loopEnd = end;
  }

  /**
   * 루프 범위 초기화 (무제한)
   */
  clearLoopRange(): void {
    this.loopStart = 0;
    this.loopEnd = Infinity;
  }

  /**
   * 루프 점프 요청 콜백 설정
   * 메트로놈이 loopEnd 도달을 감지하면 이 콜백을 호출하여 루프 점프를 요청
   * @param callback (start: number) => void - 호출 시 start 위치로 점프해야 함
   */
  setOnLoopJumpRequest(callback: ((start: number) => void) | null): void {
    this.onLoopJumpRequest = callback;
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
   * 메트로놈 시작 (video.currentTime 기반)
   * @param bpm BPM (beats per minute)
   * @param timeSignature 박자표 (예: "4/4")
   * @param metronomeOffset 메트로놈 오프셋 (첫 박 시간, 초 단위)
   * @param loopDuration 루프 길이 (초 단위, 옵션)
   * @param startBeatIndex 시작 박 인덱스 (옵션, 카운트인 등에서 사용)
   */
  start(bpm: number, timeSignature: string, metronomeOffset: number = 0, loopDuration?: number, startBeatIndex?: number): void {
    console.log('[Metronome] start() 호출:', { bpm, timeSignature, metronomeOffset, loopDuration });

    if (!this.video) {
      console.error('[Metronome] 비디오가 설정되지 않음');
      return;
    }

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
    this.metronomeOffset = metronomeOffset;
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

    // 마지막으로 스케줄링한 박 인덱스 설정
    const beatDuration = 60 / this.bpm;

    if (startBeatIndex !== undefined) {
      // startBeatIndex가 제공된 경우 (카운트인 등에서 사용)
      // 예: 4/4 카운트인에서 -5를 전달하면 beat -4, -3, -2, -1 총 4박 재생
      this.lastScheduledBeatIndex = startBeatIndex;
    } else {
      // 기본 동작: 현재 비디오 시간 기준으로 박 인덱스 계산
      const videoTime = this.video.currentTime;
      const timeFromOffset = videoTime - this.metronomeOffset;
      // -1을 빼서 현재 박은 아직 스케줄링되지 않은 것으로 처리
      this.lastScheduledBeatIndex = Math.floor(timeFromOffset / beatDuration) - 1;
    }

    // video.currentTime과 AudioContext.currentTime 간의 오프셋 계산
    this.lastVideoTime = this.video.currentTime;
    this.lastAudioContextTime = ctx.currentTime;
    this.videoToAudioOffset = this.lastAudioContextTime - this.lastVideoTime;

    this.isPlaying = true;

    console.log('[Metronome] 메트로놈 시작됨 (Look-ahead 스케줄링):', {
      bpm: this.bpm,
      beatsPerBar: this.beatsPerBar,
      metronomeOffset: this.metronomeOffset,
      videoTime: this.video.currentTime,
      startBeatIndex,
      lastScheduledBeatIndex: this.lastScheduledBeatIndex,
      videoToAudioOffset: this.videoToAudioOffset
    });

    // Look-ahead 스케줄러 시작
    this.schedulerTimer = window.setInterval(() => {
      this.lookAheadScheduler();
    }, this.POLL_INTERVAL);
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
   * @param videoTime 새로운 비디오 currentTime (초)
   */
  resync(videoTime: number): void {
    if (!this.isPlaying) {
      return;
    }

    const prevLastScheduledBeatIndex = this.lastScheduledBeatIndex;

    // 박 인덱스 재계산
    const beatDuration = 60 / this.bpm;
    const timeFromOffset = videoTime - this.metronomeOffset;

    // 현재 비디오 시간에 해당하는 박 인덱스 계산
    // floor를 사용하여 현재 시간 직전의 박 인덱스를 구함
    const currentBeatIndex = Math.floor(timeFromOffset / beatDuration);

    // 현재 박의 정확한 시간
    const currentBeatTime = this.metronomeOffset + (currentBeatIndex * beatDuration);

    // 만약 현재 시간이 박 시간을 이미 지났다면 (videoTime > currentBeatTime),
    // 그 박은 이미 지나간 것이므로 스케줄하지 않음
    // 다음 박부터 스케줄하도록 lastScheduledBeatIndex 설정
    if (videoTime > currentBeatTime + 0.01) {
      // 현재 박은 이미 지남 → 다음 박부터 스케줄
      this.lastScheduledBeatIndex = currentBeatIndex;
    } else {
      // 현재 박이 아직 안 지남 → 현재 박 스케줄 (기존 로직과 동일)
      this.lastScheduledBeatIndex = currentBeatIndex - 1;
    }

    // video-audio 오프셋 재계산
    const ctx = this.getAudioContext();
    this.lastVideoTime = videoTime;
    this.lastAudioContextTime = ctx.currentTime;
    this.videoToAudioOffset = this.lastAudioContextTime - this.lastVideoTime;

    console.log(`[Metronome] resync: videoTime=${videoTime.toFixed(3)}s, offset=${this.metronomeOffset.toFixed(3)}s, currentBeatTime=${currentBeatTime.toFixed(3)}s, beatIndex: ${prevLastScheduledBeatIndex} → ${this.lastScheduledBeatIndex}`);
  }

  /**
   * Look-ahead 스케줄러
   * 미래의 박을 예측하여 정확한 시점에 소리를 예약
   * 또한 loopEnd 도달을 감지하여 루프 점프를 요청
   */
  private lookAheadScheduler(): void {
    if (!this.video || !this.isPlaying) {
      return;
    }

    const ctx = this.getAudioContext();
    const currentVideoTime = this.video.currentTime;
    const currentAudioTime = ctx.currentTime;

    // video.currentTime과 AudioContext.currentTime 간의 오프셋 업데이트
    // 영상이 일시정지/재생되면 오프셋이 변할 수 있음
    this.videoToAudioOffset = currentAudioTime - currentVideoTime;

    const beatDuration = 60 / this.bpm;

    // 다음에 스케줄할 박의 비디오 시간 계산
    const nextBeatIndex = this.lastScheduledBeatIndex + 1;
    const nextBeatVideoTime = this.metronomeOffset + (nextBeatIndex * beatDuration);

    // 부동소수점 비교를 위한 epsilon
    // 양자화된 loopEnd와 박 시간이 부동소수점 오차로 인해 미세하게 다를 수 있음
    const EPSILON = 0.001;

    // loopEnd 직전의 마지막 박과 loopEnd 사이의 시간 계산
    // 이 시간보다 가까운 박은 스케줄하지 않음 (다음 루프의 시작점과 겹칠 수 있음)
    // 예: loopEnd=13.202, loopStart=5.202, 박 간격=0.5s
    //     마지막 박 = 13.153s (loopEnd - 0.049s)
    //     다음 박 = 13.653s (loopEnd 이후이므로 스케줄 안 됨)
    //     하지만 13.153s 박이 스케줄된 후 루프 점프 → 5.153s 박과 더블 비트
    // 해결: loopEnd와 loopStart 사이의 거리(= 한 루프 길이)가 박 간격의 정수배가 아니면
    //       마지막 박과 첫 박이 겹칠 수 있음
    const loopLength = this.loopEnd - this.loopStart;

    // loopEnd 근처에서 루프 점프 감지
    if (this.loopEnd !== Infinity && this.onLoopJumpRequest) {
      const timeUntilLoopEnd = this.loopEnd - currentVideoTime;

      // 다음 박이 loopEnd 이후이거나, loopEnd에 매우 가까우면 점프
      if (nextBeatVideoTime >= this.loopEnd - EPSILON) {
        if (timeUntilLoopEnd <= this.LOOK_AHEAD_TIME) {
          console.log(`[Metronome] loopEnd 직전 감지, 루프 점프: nextBeat=${nextBeatVideoTime.toFixed(3)}s >= loopEnd=${this.loopEnd.toFixed(3)}s, current=${currentVideoTime.toFixed(3)}s`);
          this.onLoopJumpRequest(this.loopStart);
          return;
        }
      }

      // 추가 체크: 다음 박이 loopEnd 직전(1박 이내)이고,
      // 그 박이 스케줄되면 루프 시작점의 박과 시간이 겹칠 경우 스케줄하지 않음
      // 이 경우 루프 점프가 더 빨리 발생해야 함
      const nextBeatDistanceFromEnd = this.loopEnd - nextBeatVideoTime;
      if (nextBeatDistanceFromEnd >= 0 && nextBeatDistanceFromEnd < beatDuration) {
        // 마지막 박 → 이 박이 스케줄된 직후 루프 점프가 발생할 것
        // 루프 점프 후 첫 박 시간과 겹치는지 확인
        const firstBeatAfterJump = this.loopStart;
        const timeDiff = Math.abs(nextBeatVideoTime - firstBeatAfterJump - loopLength);

        // 두 박의 시간 차이가 매우 작으면 (< 10ms) 이 박은 스케줄하지 않음
        if (timeDiff < 0.01) {
          console.log(`[Metronome] 마지막 박 스킵 (첫 박과 겹침 방지): nextBeat=${nextBeatVideoTime.toFixed(3)}s, firstBeat=${firstBeatAfterJump.toFixed(3)}s, loopLength=${loopLength.toFixed(3)}s`);
          // 대신 즉시 루프 점프
          if (timeUntilLoopEnd <= this.LOOK_AHEAD_TIME + beatDuration) {
            this.onLoopJumpRequest(this.loopStart);
            return;
          }
        }
      }
    }

    // Look-ahead 범위 내의 비디오 시간
    const lookAheadVideoTime = currentVideoTime + this.LOOK_AHEAD_TIME;
    const timeFromOffset = lookAheadVideoTime - this.metronomeOffset;

    // Look-ahead 범위 내의 마지막 박 인덱스
    const lookAheadBeatIndex = Math.floor(timeFromOffset / beatDuration);

    // 아직 스케줄링하지 않은 박들을 스케줄링
    if (lookAheadBeatIndex > this.lastScheduledBeatIndex) {
      for (let i = this.lastScheduledBeatIndex + 1; i <= lookAheadBeatIndex; i++) {
        const beatNumber = ((i % this.beatsPerBar) + this.beatsPerBar) % this.beatsPerBar;
        const isDownbeat = beatNumber === 0;

        // 이 박의 비디오 시간 계산
        const beatVideoTime = this.metronomeOffset + (i * beatDuration);

        // 루프 end 이후(또는 매우 가까운) 박은 스케줄하지 않음
        // (루프 점프 후 start에서 다시 스케줄됨)
        // EPSILON을 사용하여 부동소수점 오차로 인한 경계 박 스케줄 방지
        if (beatVideoTime >= this.loopEnd - EPSILON) {
          console.log(`[Metronome] SKIP beat ${i} (beat ${beatNumber + 1}): beatTime=${beatVideoTime.toFixed(3)}s >= loopEnd=${this.loopEnd.toFixed(3)}s - ${EPSILON}`);
          // 이 박은 스케줄하지 않지만, index는 업데이트하여 중복 시도 방지
          continue;
        }

        // 비디오 시간을 AudioContext 시간으로 변환
        const beatAudioTime = beatVideoTime + this.videoToAudioOffset;

        // 이미 지난 시간이면 즉시 재생, 그렇지 않으면 예약
        const scheduleTime = Math.max(beatAudioTime, currentAudioTime);

        // 디버그: 스케줄되는 박 정보 출력
        console.log(`[Metronome] SCHEDULE beat ${i} (beat ${beatNumber + 1}/${this.beatsPerBar}): beatTime=${beatVideoTime.toFixed(3)}s, loopEnd=${this.loopEnd.toFixed(3)}s, current=${currentVideoTime.toFixed(3)}s`);

        // 콜백 호출 (UI 업데이트용) - beatNumber + 1로 1부터 시작하는 번호 전달
        // 콜백은 박 시점에 가깝게 호출 (스케줄링 시점)
        let shouldPlayClick = true;
        if (this.onBeatCallback) {
          const result = this.onBeatCallback(beatNumber + 1, this.beatsPerBar);
          if (result === false) {
            shouldPlayClick = false;
          }
        }

        // 클릭음 스케줄링 (콜백이 false를 반환하지 않은 경우에만)
        if (shouldPlayClick) {
          this.playWoodClick(ctx, scheduleTime, isDownbeat);
        }
      }

      this.lastScheduledBeatIndex = lookAheadBeatIndex;
    }
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
