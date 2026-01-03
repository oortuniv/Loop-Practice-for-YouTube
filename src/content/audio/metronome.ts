/**
 * ScheduledBeatNodes: 스케줄된 비트의 오디오 노드들
 * 취소 시 stop() 및 disconnect() 호출 필요
 */
export interface ScheduledBeatNodes {
  noiseSource: AudioBufferSourceNode;
  oscillator: OscillatorNode;
  gainNodes: GainNode[];
}

/**
 * Metronome: 메트로놈 클릭음 재생
 *
 * 역할:
 * - 나무 메트로놈 스타일의 클릭음 생성 및 재생
 * - Web Audio API를 통한 정확한 스케줄링
 *
 * 사용법:
 * 1. scheduleBeatAt(audioTime, isDownbeat) - 특정 시간에 비트 스케줄
 * 2. playClickNow(isDownbeat) - 즉시 재생 (TAP 피드백 등)
 */
export class Metronome {
  private audioContext: AudioContext | null = null;

  // 볼륨 설정 (0.0 ~ 1.0, 실제 출력은 MAX_VOLUME을 곱함)
  private volume: number = 0.9;
  private readonly MAX_VOLUME = 8.0;

  // 음소거 상태
  private muted: boolean = false;

  constructor() {}

  /**
   * 볼륨 설정
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
   * 음소거 설정
   */
  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  /**
   * 음소거 상태 확인
   */
  isMuted(): boolean {
    return this.muted;
  }

  /**
   * AudioContext 가져오기 (필요시 생성)
   */
  getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    return this.audioContext;
  }

  /**
   * 특정 오디오 시간에 비트 스케줄 (이벤트 기반 스케줄링용)
   * @param audioTime AudioContext.currentTime 기준 스케줄 시간
   * @param isDownbeat 첫 박 여부
   * @returns 스케줄된 오디오 노드들 (취소용)
   */
  scheduleBeatAt(audioTime: number, isDownbeat: boolean): ScheduledBeatNodes | null {
    if (this.muted) return null;

    const ctx = this.getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // 이미 지난 시간이면 스킵
    if (audioTime < ctx.currentTime) {
      console.warn('[Metronome] 비트 스킵 (이미 지난 시간):', {
        scheduledTime: audioTime.toFixed(3),
        currentTime: ctx.currentTime.toFixed(3),
        late: (ctx.currentTime - audioTime).toFixed(3)
      });
      return null;
    }

    return this.createWoodClickNodes(ctx, audioTime, isDownbeat);
  }

  /**
   * 즉시 클릭음 재생 (TAP Sync 피드백용)
   */
  playClickNow(isDownbeat: boolean): void {
    if (this.muted) return;

    const ctx = this.getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    this.createWoodClickNodes(ctx, ctx.currentTime, isDownbeat);
  }

  /**
   * AudioContext 워밍업
   */
  warmup(): void {
    const ctx = this.getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
  }

  /**
   * 리소스 정리
   */
  dispose(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  /**
   * 나무 메트로놈 클릭음 노드 생성 및 스케줄
   * @returns 생성된 오디오 노드들
   */
  private createWoodClickNodes(ctx: AudioContext, when: number, isDownbeat: boolean): ScheduledBeatNodes {
    // DAW 표준: 첫박은 더 높은 피치 + 약간 더 큰 볼륨
    // Logic Pro, Ableton 등 대부분의 DAW가 이 방식 사용
    const baseVolume = isDownbeat ? 1.0 : 0.75;
    const finalVolume = baseVolume * this.volume * this.MAX_VOLUME;
    // 첫박: 높은 피치 (1.0 기준), 일반박: 낮은 피치 (0.7)
    const pitchMultiplier = isDownbeat ? 1.0 : 0.7;

    const gainNodes: GainNode[] = [];

    // 1. 노이즈 버스트 (짧은 화이트 노이즈)
    const noiseBuffer = this.createNoiseBuffer(ctx, 0.02);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    // 2. 밴드패스 필터 (나무 특성 주파수)
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 1800 * pitchMultiplier;
    bandpass.Q.value = 2;

    // 3. 하이패스 필터 (저음 제거)
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 400;

    // 4. 게인 엔벨로프
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, when);
    noiseGain.gain.linearRampToValueAtTime(finalVolume, when + 0.001);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, when + 0.025);
    gainNodes.push(noiseGain);

    // 연결
    noiseSource.connect(bandpass);
    bandpass.connect(highpass);
    highpass.connect(noiseGain);
    noiseGain.connect(ctx.destination);

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
    gainNodes.push(oscGain);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);

    osc.start(when);
    osc.stop(when + 0.02);

    return {
      noiseSource,
      oscillator: osc,
      gainNodes
    };
  }

  /**
   * 화이트 노이즈 버퍼 생성
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
}

/**
 * 스케줄된 비트 노드 취소
 */
export function cancelScheduledBeat(nodes: ScheduledBeatNodes | null): void {
  if (!nodes) return;

  try {
    nodes.noiseSource.stop();
    nodes.noiseSource.disconnect();
  } catch {
    // 이미 정지됨
  }

  try {
    nodes.oscillator.stop();
    nodes.oscillator.disconnect();
  } catch {
    // 이미 정지됨
  }

  for (const gain of nodes.gainNodes) {
    try {
      gain.disconnect();
    } catch {
      // 이미 연결 해제됨
    }
  }
}
