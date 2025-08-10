import { describe, it, expect, beforeEach, vi } from 'vitest';
import { YouTubeLoopPractice } from './index';

// Mock HTMLVideoElement
const createMockVideo = (currentTime = 0, duration = 100) => {
  const video = document.createElement('video');
  Object.defineProperty(video, 'currentTime', {
    writable: true,
    value: currentTime
  });
  Object.defineProperty(video, 'duration', {
    writable: true,
    value: duration
  });
  return video;
};

// Mock Chrome API
global.chrome = {
  runtime: {
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  }
} as any;

describe('YouTubeLoopPractice - 루프 이름 자동 지정', () => {
  let practice: YouTubeLoopPractice;
  let mockVideo: HTMLVideoElement;

  beforeEach(() => {
    practice = new YouTubeLoopPractice();
    mockVideo = createMockVideo(90, 300); // 1:30 위치, 5분 영상
  });

  describe('createSegment - 라벨 자동 생성', () => {
    it('라벨이 비어있을 때 시작 시간 ~ 끝 시간으로 자동 생성', () => {
      // Given: 1:30 위치에서 구간 생성
      Object.defineProperty(mockVideo, 'currentTime', { value: 90 });
      (practice as any).video = mockVideo;
      (practice as any).profile = {
        segments: [],
        defaultRate: 1.0
      };

      // When: 라벨 없이 구간 생성
      (practice as any).createSegment('');

      // Then: 라벨이 "1:30~1:40" 형태로 생성되어야 함
      const segments = (practice as any).profile.segments;
      expect(segments).toHaveLength(1);
      expect(segments[0].label).toBe('1:30~1:40');
      expect(segments[0].start).toBe(90);
      expect(segments[0].end).toBe(100);
    });

    it('라벨이 제공되면 사용자 지정 라벨 사용', () => {
      // Given: 1:30 위치에서 구간 생성
      Object.defineProperty(mockVideo, 'currentTime', { value: 90 });
      (practice as any).video = mockVideo;
      (practice as any).profile = {
        segments: [],
        defaultRate: 1.0
      };

      // When: 사용자 라벨로 구간 생성
      (practice as any).createSegment('연습 구간');

      // Then: 사용자 라벨이 사용되어야 함
      const segments = (practice as any).profile.segments;
      expect(segments).toHaveLength(1);
      expect(segments[0].label).toBe('연습 구간');
    });

    it('영상 끝 부분에서 구간 생성 시 duration을 초과하지 않음', () => {
      // Given: 영상 끝 부분에서 구간 생성
      Object.defineProperty(mockVideo, 'currentTime', { value: 295 });
      Object.defineProperty(mockVideo, 'duration', { value: 300 });
      (practice as any).video = mockVideo;
      (practice as any).profile = {
        segments: [],
        defaultRate: 1.0
      };

      // When: 라벨 없이 구간 생성
      (practice as any).createSegment('');

      // Then: 끝 시간이 duration을 초과하지 않아야 함
      const segments = (practice as any).profile.segments;
      expect(segments).toHaveLength(1);
      expect(segments[0].end).toBe(300);
      expect(segments[0].label).toBe('4:55~5:00');
    });

    it('0초 위치에서 구간 생성 시 올바른 라벨 생성', () => {
      // Given: 0초 위치에서 구간 생성
      Object.defineProperty(mockVideo, 'currentTime', { value: 0 });
      (practice as any).video = mockVideo;
      (practice as any).profile = {
        segments: [],
        defaultRate: 1.0
      };

      // When: 라벨 없이 구간 생성
      (practice as any).createSegment('');

      // Then: 라벨이 "0:00~0:10" 형태로 생성되어야 함
      const segments = (practice as any).profile.segments;
      expect(segments).toHaveLength(1);
      expect(segments[0].label).toBe('0:00~0:10');
    });
  });

  describe('GET_CURRENT_TIME 메시지 처리', () => {
    it('현재 시간을 올바르게 반환', () => {
      // Given: 비디오가 설정된 상태
      Object.defineProperty(mockVideo, 'currentTime', { value: 125 });
      (practice as any).video = mockVideo;

      // When: GET_CURRENT_TIME 메시지 처리
      const sendResponse = vi.fn();
      (practice as any).handleMessage(
        { type: 'GET_CURRENT_TIME' },
        null,
        sendResponse
      );

      // Then: 현재 시간이 반환되어야 함
      expect(sendResponse).toHaveBeenCalledWith({ currentTime: 125 });
    });

    it('비디오가 없을 때 0 반환', () => {
      // Given: 비디오가 없는 상태
      (practice as any).video = undefined;

      // When: GET_CURRENT_TIME 메시지 처리
      const sendResponse = vi.fn();
      (practice as any).handleMessage(
        { type: 'GET_CURRENT_TIME' },
        null,
        sendResponse
      );

      // Then: 0이 반환되어야 함
      expect(sendResponse).toHaveBeenCalledWith({ currentTime: 0 });
    });
  });
});

describe('YouTubeLoopPractice - 구간 활성화 토글', () => {
  let practice: YouTubeLoopPractice;
  let mockVideo: HTMLVideoElement;

  beforeEach(() => {
    practice = new YouTubeLoopPractice();
    mockVideo = createMockVideo(50, 300);
  });

  it('구간 활성화 클릭 시 토글이 정상 작동함 (버그 수정됨)', () => {
    // Given: 구간이 있고 활성화되지 않은 상태
    const segment = {
      id: 'segment1',
      start: 40,
      end: 60,
      rate: 1.0,
      label: '테스트 구간'
    };
    
    (practice as any).profile = {
      segments: [segment],
      activeSegmentId: null,
      defaultRate: 1.0
    };
    (practice as any).video = mockVideo;
    (practice as any).loopController = {
      setProfile: vi.fn(),
      setActive: vi.fn()
    };

    // When: 구간 활성화
    (practice as any).activateSegment('segment1');

    // Then: 구간이 활성화됨
    expect((practice as any).profile.activeSegmentId).toBe('segment1');

    // When: 같은 구간을 다시 클릭
    (practice as any).activateSegment('segment1');

    // Then: 구간이 비활성화됨 (토글됨)
    expect((practice as any).profile.activeSegmentId).toBeNull();
  });

  it('toggleLoop은 정상적으로 토글됨', () => {
    // Given: 구간이 있고 활성화되지 않은 상태
    const segment = {
      id: 'segment1',
      start: 40,
      end: 60,
      rate: 1.0,
      label: '테스트 구간'
    };
    
    (practice as any).profile = {
      segments: [segment],
      activeSegmentId: null,
      defaultRate: 1.0
    };
    (practice as any).video = mockVideo;
    (practice as any).loopController = {
      setProfile: vi.fn(),
      setActive: vi.fn()
    };

    // When: toggleLoop 호출 (현재 시간이 구간 내부)
    Object.defineProperty(mockVideo, 'currentTime', { value: 50 });
    (practice as any).toggleLoop();

    // Then: 구간이 활성화됨
    expect((practice as any).profile.activeSegmentId).toBe('segment1');

    // When: toggleLoop 다시 호출
    (practice as any).toggleLoop();

    // Then: 구간이 비활성화됨 (토글됨)
    expect((practice as any).profile.activeSegmentId).toBeNull();
  });
});
