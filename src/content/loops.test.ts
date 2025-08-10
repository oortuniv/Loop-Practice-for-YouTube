import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LoopController } from './loops';
import { VideoProfile } from '../types';

// Mock HTMLVideoElement
const createMockVideo = () => {
  const video = {
    currentTime: 0,
    duration: 100,
    paused: false,
    playbackRate: 1.0,
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  } as any;
  
  return video;
};

describe('LoopController', () => {
  let loopController: LoopController;
  let mockVideo: any;
  let mockProfile: VideoProfile;

  beforeEach(() => {
    mockVideo = createMockVideo();
    mockProfile = {
      videoId: 'test123',
      defaultRate: 1.0,
      segments: [
        {
          id: 'segment1',
          start: 10,
          end: 20,
          rate: 1.0,
          label: '테스트 구간'
        }
      ],
      activeSegmentId: null,
      bpm: undefined,
      countInBeats: 4,
      metronomeEnabled: false
    };
    
    loopController = new LoopController(mockVideo, mockProfile);
  });

  describe('루프 기능', () => {
    it('활성 구간이 있을 때 끝 지점에서 시작 지점으로 점프해야 함', () => {
      // 구간 활성화
      loopController.setActive('segment1');
      
      // 현재 시간을 구간 끝을 넘어서 설정
      mockVideo.currentTime = 20.5;
      
      // tick 호출
      loopController.tick();
      
      // 시작 지점으로 점프해야 함
      expect(mockVideo.currentTime).toBe(10);
    });

    it('구간 내에서 재생 중일 때는 점프하지 않아야 함', () => {
      // 구간 활성화
      loopController.setActive('segment1');
      
      // 구간 내 시간
      mockVideo.currentTime = 15;
      
      // tick 호출
      loopController.tick();
      
      // 점프하지 않아야 함
      expect(mockVideo.currentTime).toBe(15);
    });

    it('활성 구간이 없으면 루프가 동작하지 않아야 함', () => {
      // 활성 구간이 없는 상태
      loopController.setActive(null);
      
      // 현재 시간을 구간 끝을 넘어서 설정
      mockVideo.currentTime = 25;
      
      // tick 호출
      loopController.tick();
      
      // currentTime이 변경되지 않아야 함
      expect(mockVideo.currentTime).toBe(25);
    });
  });

  describe('구간 활성화/비활성화', () => {
    it('구간을 활성화하면 active 상태가 설정되어야 함', () => {
      loopController.setActive('segment1');
      
      const active = loopController.getActive();
      expect(active).toBeDefined();
      expect(active?.id).toBe('segment1');
    });

    it('구간을 비활성화하면 active 상태가 해제되어야 함', () => {
      loopController.setActive('segment1');
      loopController.setActive(null);
      
      const active = loopController.getActive();
      expect(active).toBeUndefined();
    });
  });
});
