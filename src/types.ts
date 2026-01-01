export type LoopSegment = {
  id: string;
  start: number;
  end: number;
  rate: number;
  label?: string;
  metronomeEnabled?: boolean;  // 이 루프에서 메트로놈 활성화 여부

  // 로컬 Beat Sync 설정 (없거나 useGlobalSync가 true면 글로벌 설정 사용)
  useGlobalSync?: boolean;           // 기본값: true (글로벌 설정 사용)
  localTempo?: number;               // 로컬 BPM
  localTimeSignature?: TimeSignature; // 로컬 박자표
  localMetronomeOffset?: number;     // 로컬 첫 박 오프셋 (초 단위)
};

export type TimeSignature = '2/4' | '3/4' | '4/4' | '5/4' | '6/8' | '7/8' | '9/8' | '12/8' | '3/8' | '6/4';

export type VideoProfile = {
  videoId: string;
  defaultRate: number;              // 전체 영상 기본 속도
  segments: LoopSegment[];          // 여러 구간
  activeSegmentId?: string | null;  // 현재 활성화된 구간
  tempo?: number;                   // BPM (beats per minute)
  timeSignature?: TimeSignature;    // 박자표 (time signature)
  globalMetronomeOffset?: number;   // 글로벌 메트로놈 오프셋 (초 단위, 영상 시작 후 첫 박까지의 시간)
  videoTitle?: string;              // 영상 제목
  channelName?: string;             // 채널 이름
};

export type CommandMessage = {
  type: 'COMMAND';
  command: string;
};

export type StorageKey = `vid:${string}`; 