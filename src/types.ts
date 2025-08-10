export type LoopSegment = { 
  id: string; 
  start: number; 
  end: number; 
  rate: number; 
  label?: string 
};

export type VideoProfile = {
  videoId: string;
  defaultRate: number;              // 전체 영상 기본 속도
  segments: LoopSegment[];          // 여러 구간
  activeSegmentId?: string | null;  // 현재 활성화된 구간
  bpm?: number;                      // 사용자가 감지/설정한 BPM
  countInBeats?: number;             // 카운트인 비트 수(기본 4)
  metronomeEnabled?: boolean;
};

export type CommandMessage = {
  type: 'COMMAND';
  command: string;
};

export type StorageKey = `vid:${string}`; 