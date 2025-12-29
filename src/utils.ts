export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function isInputElement(element: HTMLElement): boolean {
  if (!element || !element.tagName) {
    return false;
  }
  
  const tag = element.tagName.toLowerCase();
  return ['input', 'textarea', 'select'].includes(tag) || 
         element.contentEditable === 'true' ||
         element.isContentEditable;
}

export function throttle<T extends (...args: any[]) => any>(
  func: T, 
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return function(this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return function(this: any, ...args: Parameters<T>) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

/**
 * 박자표 문자열을 파싱하여 [beatsPerBar, beatUnit] 배열로 반환
 * @param ts 박자표 문자열 (예: "4/4", "6/8")
 * @returns [beatsPerBar, beatUnit] 배열
 */
export function parseTimeSignature(ts: string): [number, number] {
  const parts = ts.split('/');
  return [parseInt(parts[0], 10), parseInt(parts[1], 10)];
}

/**
 * 마디(bars)를 초(seconds)로 변환
 * @param bars 마디 수
 * @param bpm BPM (beats per minute)
 * @param timeSignature 박자표 (예: "4/4")
 * @returns 초 단위 시간
 */
export function barsToSeconds(bars: number, bpm: number, timeSignature: string): number {
  const [beatsPerBar, beatUnit] = parseTimeSignature(timeSignature);
  const beatDuration = 60 / bpm;
  const beatMultiplier = 4 / beatUnit;
  return bars * beatsPerBar * beatMultiplier * beatDuration;
}

/**
 * 초(seconds)를 마디(bars)로 변환
 * @param seconds 초 단위 시간
 * @param bpm BPM (beats per minute)
 * @param timeSignature 박자표 (예: "4/4")
 * @returns 마디 수
 */
export function secondsToBars(seconds: number, bpm: number, timeSignature: string): number {
  const [beatsPerBar, beatUnit] = parseTimeSignature(timeSignature);
  const beatDuration = 60 / bpm;
  const beatMultiplier = 4 / beatUnit;
  const totalBeats = seconds / beatDuration;
  return totalBeats / (beatsPerBar * beatMultiplier);
}

/**
 * 마디 수를 포맷팅하여 문자열로 반환
 * @param bars 마디 수
 * @param precision 소수점 자릿수 (기본: 2)
 * @returns 포맷팅된 마디 수 문자열
 */
export function formatBars(bars: number, precision: number = 2): string {
  return bars.toFixed(precision);
} 