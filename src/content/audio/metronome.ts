export class Metronome {
  private ctx?: AudioContext;
  private running = false;
  private nextTime = 0;
  private scheduleTimeout?: NodeJS.Timeout;

  start(bpm: number): void {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    if (this.running) return;
    
    const ctx = this.ctx;
    this.running = true;
    const interval = 60 / bpm; // 비트 간격 (초)
    
    // 다음 클릭 시간 설정
    this.nextTime = ctx.currentTime + 0.05;
    
    const schedule = () => {
      if (!this.running || !ctx) return;
      
      const now = ctx.currentTime;
      
      // 미래 0.15초 동안의 클릭들을 스케줄
      while (this.nextTime < now + 0.15) {
        this.click(this.nextTime, bpm);
        this.nextTime += interval;
      }
      
      // 다음 스케줄링
      this.scheduleTimeout = setTimeout(schedule, 25);
    };
    
    schedule();
  }

  stop(): void {
    this.running = false;
    if (this.scheduleTimeout) {
      clearTimeout(this.scheduleTimeout);
      this.scheduleTimeout = undefined;
    }
  }

  private click(when: number, bpm: number): void {
    if (!this.ctx) return;
    
    const ctx = this.ctx;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    // 클릭 소리 생성 (두 음색: downbeat와 나머지)
    const isDownbeat = Math.floor(when * bpm / 60) % 4 === 0;
    
    if (isDownbeat) {
      // Downbeat: 더 낮은 주파수, 더 큰 볼륨
      oscillator.frequency.value = 800;
      gainNode.gain.value = 0.3;
    } else {
      // 일반 비트: 더 높은 주파수, 작은 볼륨
      oscillator.frequency.value = 1200;
      gainNode.gain.value = 0.15;
    }
    
    // ADSR 엔벨로프
    const attackTime = 0.01;
    const decayTime = 0.05;
    const sustainLevel = 0.7;
    const releaseTime = 0.1;
    
    gainNode.gain.setValueAtTime(0, when);
    gainNode.gain.linearRampToValueAtTime(gainNode.gain.value, when + attackTime);
    gainNode.gain.exponentialRampToValueAtTime(sustainLevel * gainNode.gain.value, when + attackTime + decayTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, when + attackTime + decayTime + releaseTime);
    
    oscillator.connect(gainNode).connect(ctx.destination);
    oscillator.start(when);
    oscillator.stop(when + attackTime + decayTime + releaseTime);
  }

  // BPM 변경 시 메트로놈 재시작
  changeBpm(bpm: number): void {
    if (this.running) {
      this.stop();
      this.start(bpm);
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  // AudioContext 일시정지/재개
  suspend(): void {
    this.ctx?.suspend();
  }

  resume(): void {
    this.ctx?.resume();
  }
} 