export class BpmDetector {
  private ctx?: AudioContext;
  private taps: number[] = [];
  private lastTapTime = 0;

  // 탭 템포로 BPM 계산
  tapTempo(): number | null {
    const now = Date.now();
    
    // 첫 번째 탭이거나 마지막 탭으로부터 3초 이상 지났으면 탭 배열 초기화
    if (this.taps.length === 0 || now - this.lastTapTime > 3000) {
      this.taps = [];
    }
    
    this.taps.push(now);
    this.lastTapTime = now;
    
    // 최소 2번의 탭이 있어야 BPM 계산 가능
    if (this.taps.length < 2) return null;
    
    // 탭 간격들의 평균 계산
    const intervals: number[] = [];
    for (let i = 1; i < this.taps.length; i++) {
      intervals.push(this.taps[i] - this.taps[i - 1]);
    }
    
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const bpm = Math.round(60000 / avgInterval); // ms를 BPM으로 변환
    
    // BPM 범위 제한 (60-200)
    return Math.max(60, Math.min(200, bpm));
  }

  // 탭 배열 초기화
  clearTaps(): void {
    this.taps = [];
  }

  // 탭 개수 반환
  getTapCount(): number {
    return this.taps.length;
  }

  // Web Audio를 사용한 자동 BPM 감지 (간단한 구현)
  async detectFromVideo(video: HTMLVideoElement, windowSec = 3): Promise<number | null> {
    try {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      // 비디오에서 오디오 스트림 캡처 시도
      let source: MediaStreamAudioSourceNode;
      
      try {
        // captureStream() 사용 (CORS 제약이 있을 수 있음)
        const stream = (video as any).captureStream();
        source = this.ctx.createMediaStreamSource(stream);
      } catch {
        // 실패 시 null 반환 (탭 템포로 폴백)
        return null;
      }
      
      // 분석기 노드 생성
      const analyser = this.ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      
      // 오디오 데이터 수집
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const samples: number[] = [];
      
      const startTime = Date.now();
      const sampleInterval = 50; // 50ms마다 샘플링
      
      return new Promise((resolve) => {
        const sample = () => {
          if (Date.now() - startTime > windowSec * 1000) {
            // 샘플링 완료, BPM 계산
            const bpm = this.calculateBpmFromSamples(samples);
            resolve(bpm);
            return;
          }
          
          analyser.getByteFrequencyData(dataArray);
          
          // 주파수 데이터의 평균 계산 (간단한 볼륨 측정)
          const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
          samples.push(average);
          
          setTimeout(sample, sampleInterval);
        };
        
        sample();
      });
      
    } catch (error) {
      console.warn('BPM 감지 실패:', error);
      return null;
    }
  }

  // 샘플 데이터에서 BPM 계산 (간단한 피크 감지)
  private calculateBpmFromSamples(samples: number[]): number | null {
    if (samples.length < 20) return null;
    
    // 볼륨 임계값 설정
    const threshold = Math.max(...samples) * 0.7;
    
    // 피크 위치 찾기
    const peaks: number[] = [];
    for (let i = 1; i < samples.length - 1; i++) {
      if (samples[i] > threshold && 
          samples[i] > samples[i - 1] && 
          samples[i] > samples[i + 1]) {
        peaks.push(i);
      }
    }
    
    if (peaks.length < 3) return null;
    
    // 피크 간격 계산
    const intervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i - 1]);
    }
    
    // 평균 간격 계산
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    
    // 샘플링 간격(50ms)을 고려하여 BPM 계산
    const bpm = Math.round(60000 / (avgInterval * 50));
    
    // BPM 범위 제한 (60-200)
    return Math.max(60, Math.min(200, bpm));
  }
} 