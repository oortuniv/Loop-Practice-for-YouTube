export class CountIn {
  private ctx?: AudioContext;
  private running = false;

  async run(params: {
    beats: number;
    bpm: number;
    onComplete: () => void;
  }): Promise<void> {
    const { beats, bpm, onComplete } = params;
    
    if (this.running) return;
    
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    this.running = true;
    const interval = 60 / bpm; // 비트 간격 (초)
    const startTime = this.ctx.currentTime + 0.1;
    
    // 카운트인 클릭 재생
    for (let i = 0; i < beats; i++) {
      const clickTime = startTime + i * interval;
      this.playCountInClick(clickTime, i === 0); // 첫 번째 클릭은 다운비트
    }
    
    // 카운트인 완료 후 콜백 실행
    const completeTime = startTime + beats * interval;
    setTimeout(() => {
      this.running = false;
      onComplete();
    }, (completeTime - this.ctx.currentTime) * 1000);
  }

  private playCountInClick(when: number, isDownbeat: boolean): void {
    if (!this.ctx) return;
    
    const ctx = this.ctx;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    if (isDownbeat) {
      // 다운비트: 더 낮은 주파수, 더 큰 볼륨
      oscillator.frequency.value = 600;
      gainNode.gain.value = 0.4;
    } else {
      // 일반 비트: 더 높은 주파수, 작은 볼륨
      oscillator.frequency.value = 1000;
      gainNode.gain.value = 0.2;
    }
    
    // 짧은 클릭 사운드
    const duration = 0.05;
    
    gainNode.gain.setValueAtTime(0, when);
    gainNode.gain.linearRampToValueAtTime(gainNode.gain.value, when + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, when + duration);
    
    oscillator.connect(gainNode).connect(ctx.destination);
    oscillator.start(when);
    oscillator.stop(when + duration);
  }

  isRunning(): boolean {
    return this.running;
  }

  stop(): void {
    this.running = false;
  }
} 