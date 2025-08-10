import { describe, it, expect, vi, beforeEach } from 'vitest';
import { YouTubeLoopPractice } from './index';

// Mock DOM
const mockDocument = {
  querySelector: vi.fn(),
  readyState: 'complete'
};

// Mock window
const mockWindow = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  location: {
    href: 'https://www.youtube.com/watch?v=test123',
    pathname: '/watch'
  }
};

// Mock chrome
const mockChrome = {
  runtime: {
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  },
  storage: {
    sync: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined)
    }
  }
};

// Global mocks
global.document = mockDocument as any;
global.window = mockWindow as any;
global.chrome = mockChrome as any;

describe('Content Script 연결', () => {
  let extension: YouTubeLoopPractice;

  beforeEach(() => {
    // Mock video element
    const mockVideo = {
      currentTime: 0,
      duration: 100,
      paused: false,
      playbackRate: 1.0,
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };
    
    mockDocument.querySelector.mockReturnValue(mockVideo);
    extension = new YouTubeLoopPractice();
  });

  it('PING 메시지에 응답해야 함', async () => {
    // 직접 초기화하지 않고 메시지 핸들러만 테스트
    const sendResponse = vi.fn();
    extension['handleMessage']({ type: 'PING' }, {}, sendResponse);
    
    expect(sendResponse).toHaveBeenCalledWith({
      status: 'ok',
      timestamp: expect.any(Number),
      initialized: expect.any(Boolean)
    });
  });

  it('GET_CURRENT_TIME 메시지에 응답해야 함', async () => {
    // 직접 초기화하지 않고 메시지 핸들러만 테스트
    const sendResponse = vi.fn();
    extension['handleMessage']({ type: 'GET_CURRENT_TIME' }, {}, sendResponse);
    
    expect(sendResponse).toHaveBeenCalledWith({
      currentTime: expect.any(Number)
    });
  });

  it('ACTIVATE_SEGMENT 메시지에 응답해야 함', async () => {
    // 직접 초기화하지 않고 메시지 핸들러만 테스트
    const sendResponse = vi.fn();
    extension['handleMessage']({ 
      type: 'ACTIVATE_SEGMENT', 
      segmentId: 'test-segment' 
    }, {}, sendResponse);
    
    // 초기화되지 않은 상태에서는 에러 응답
    expect(sendResponse).toHaveBeenCalledWith({
      error: 'Content script not initialized'
    });
  });
});
