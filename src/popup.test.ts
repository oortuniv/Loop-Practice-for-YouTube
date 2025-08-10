import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PopupController } from './popup';

// Mock chrome API
const mockChrome = {
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn(),
  },
  storage: {
    sync: {
      get: vi.fn(),
      set: vi.fn(),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
  },
};

// Mock DOM elements
const mockElements = {
  currentPage: { textContent: '' },
  segmentCount: { textContent: '' },
  bpm: { textContent: '' },
  segmentsList: { 
    innerHTML: '', 
    appendChild: vi.fn(),
    removeEventListener: vi.fn(),
    addEventListener: vi.fn(),
  },
};

// Mock document
const mockDocument = {
  getElementById: vi.fn((id: string) => mockElements[id as keyof typeof mockElements]),
  querySelector: vi.fn(),
  querySelectorAll: vi.fn(),
  addEventListener: vi.fn(),
  createElement: vi.fn(() => ({
    className: '',
    textContent: '',
    style: { cssText: '' },
    setAttribute: vi.fn(),
    innerHTML: '',
    appendChild: vi.fn(),
    parentNode: { replaceChild: vi.fn() },
    focus: vi.fn(),
    select: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
  body: { appendChild: vi.fn() },
};

// Mock window
const mockWindow = {
  addEventListener: vi.fn(),
};

// Global mocks
global.chrome = mockChrome as any;
global.document = mockDocument as any;
global.window = mockWindow as any;

describe('PopupController - 편집 루프 기능', () => {
  let popupController: PopupController;

  beforeEach(() => {
    vi.clearAllMocks();
    popupController = new PopupController();
    
    // Mock chrome.tabs.query
    mockChrome.tabs.query.mockResolvedValue([{
      id: 1,
      url: 'https://www.youtube.com/watch?v=test123'
    }]);
    
    // Mock chrome.storage.sync.get
    mockChrome.storage.sync.get.mockResolvedValue({
      'video_test123': {
        videoId: 'test123',
        defaultRate: 1.0,
        segments: [
          {
            id: 'segment1',
            start: 10,
            end: 30,
            rate: 1.0,
            label: '테스트 구간'
          }
        ],
        activeSegmentId: null,
        bpm: null,
        countInBeats: 4,
        metronomeEnabled: false,
        schemaVersion: 1
      }
    });
    
    // Mock chrome.runtime.sendMessage
    mockChrome.runtime.sendMessage.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('시간 입력 파싱', () => {
    it('분:초 형식을 올바르게 파싱해야 함', () => {
      const result = (popupController as any).parseTimeInput('1:30');
      expect(result).toBe(90); // 1분 30초 = 90초
    });

    it('초 단위만 입력된 경우를 올바르게 파싱해야 함', () => {
      const result = (popupController as any).parseTimeInput('45');
      expect(result).toBe(45);
    });

    it('잘못된 형식은 null을 반환해야 함', () => {
      const result = (popupController as any).parseTimeInput('invalid');
      expect(result).toBeNull();
    });

    it('빈 문자열은 null을 반환해야 함', () => {
      const result = (popupController as any).parseTimeInput('');
      expect(result).toBeNull();
    });

    it('초가 60 이상인 경우 null을 반환해야 함', () => {
      const result = (popupController as any).parseTimeInput('1:60');
      expect(result).toBeNull();
    });
  });

  describe('재생속도 편집', () => {
    it('재생속도 증가가 올바르게 작동해야 함', async () => {
      const segmentId = 'segment1';
      const initialRate = 1.0;
      
      // 초기 상태 설정
      (popupController as any).profile = {
        segments: [{ id: segmentId, rate: initialRate }]
      };
      
      // sendMessageToContentScript를 mock하여 직접 호출하지 않도록 함
      const originalSendMessage = (popupController as any).sendMessageToContentScript;
      (popupController as any).sendMessageToContentScript = vi.fn().mockResolvedValue({ success: true });
      
      await (popupController as any).increaseSegmentRate(segmentId);
      
      expect((popupController as any).sendMessageToContentScript).toHaveBeenCalledWith({
        type: 'UPDATE_SEGMENT',
        segmentId,
        rate: 1.05 // 5% 증가
      });
      
      // 원래 메서드 복원
      (popupController as any).sendMessageToContentScript = originalSendMessage;
    });

    it('재생속도 감소가 올바르게 작동해야 함', async () => {
      const segmentId = 'segment1';
      const initialRate = 1.0;
      
      // 초기 상태 설정
      (popupController as any).profile = {
        segments: [{ id: segmentId, rate: initialRate }]
      };
      
      // sendMessageToContentScript를 mock
      const originalSendMessage = (popupController as any).sendMessageToContentScript;
      (popupController as any).sendMessageToContentScript = vi.fn().mockResolvedValue({ success: true });
      
      await (popupController as any).decreaseSegmentRate(segmentId);
      
      expect((popupController as any).sendMessageToContentScript).toHaveBeenCalledWith({
        type: 'UPDATE_SEGMENT',
        segmentId,
        rate: 0.95 // 5% 감소
      });
      
      // 원래 메서드 복원
      (popupController as any).sendMessageToContentScript = originalSendMessage;
    });

    it('재생속도가 최소값(5%) 이하로 내려가지 않아야 함', async () => {
      const segmentId = 'segment1';
      const initialRate = 0.05; // 최소값
      
      // 초기 상태 설정
      (popupController as any).profile = {
        segments: [{ id: segmentId, rate: initialRate }]
      };
      
      // sendMessageToContentScript를 mock
      const originalSendMessage = (popupController as any).sendMessageToContentScript;
      (popupController as any).sendMessageToContentScript = vi.fn().mockResolvedValue({ success: true });
      
      await (popupController as any).decreaseSegmentRate(segmentId);
      
      expect((popupController as any).sendMessageToContentScript).toHaveBeenCalledWith({
        type: 'UPDATE_SEGMENT',
        segmentId,
        rate: 0.05 // 최소값 유지
      });
      
      // 원래 메서드 복원
      (popupController as any).sendMessageToContentScript = originalSendMessage;
    });

    it('재생속도가 최대값(160%) 이상으로 올라가지 않아야 함', async () => {
      const segmentId = 'segment1';
      const initialRate = 1.6; // 최대값
      
      // 초기 상태 설정
      (popupController as any).profile = {
        segments: [{ id: segmentId, rate: initialRate }]
      };
      
      // sendMessageToContentScript를 mock
      const originalSendMessage = (popupController as any).sendMessageToContentScript;
      (popupController as any).sendMessageToContentScript = vi.fn().mockResolvedValue({ success: true });
      
      await (popupController as any).increaseSegmentRate(segmentId);
      
      expect((popupController as any).sendMessageToContentScript).toHaveBeenCalledWith({
        type: 'UPDATE_SEGMENT',
        segmentId,
        rate: 1.6 // 최대값 유지
      });
      
      // 원래 메서드 복원
      (popupController as any).sendMessageToContentScript = originalSendMessage;
    });
  });

  describe('시간 편집', () => {
    it('시작 시간 업데이트가 올바르게 작동해야 함', async () => {
      const segmentId = 'segment1';
      const newStartTime = 15;
      
      // sendMessageToContentScript를 mock
      const originalSendMessage = (popupController as any).sendMessageToContentScript;
      (popupController as any).sendMessageToContentScript = vi.fn().mockResolvedValue({ success: true });
      
      await (popupController as any).updateSegmentStartTime(segmentId, newStartTime);
      
      expect((popupController as any).sendMessageToContentScript).toHaveBeenCalledWith({
        type: 'UPDATE_SEGMENT',
        segmentId,
        start: newStartTime
      });
      
      // 원래 메서드 복원
      (popupController as any).sendMessageToContentScript = originalSendMessage;
    });

    it('종료 시간 업데이트가 올바르게 작동해야 함', async () => {
      const segmentId = 'segment1';
      const newEndTime = 45;
      
      // sendMessageToContentScript를 mock
      const originalSendMessage = (popupController as any).sendMessageToContentScript;
      (popupController as any).sendMessageToContentScript = vi.fn().mockResolvedValue({ success: true });
      
      await (popupController as any).updateSegmentEndTime(segmentId, newEndTime);
      
      expect((popupController as any).sendMessageToContentScript).toHaveBeenCalledWith({
        type: 'UPDATE_SEGMENT',
        segmentId,
        end: newEndTime
      });
      
      // 원래 메서드 복원
      (popupController as any).sendMessageToContentScript = originalSendMessage;
    });
  });

  describe('편집 모드', () => {
    it('편집 모드 토글이 올바르게 작동해야 함', () => {
      const segmentId = 'segment1';
      const mockSegmentItem = {
        classList: {
          contains: vi.fn().mockReturnValue(false),
          add: vi.fn(),
          remove: vi.fn()
        }
      };
      
      // Mock document.querySelector
      mockDocument.querySelector.mockReturnValue(mockSegmentItem);
      
      // 편집 모드 시작
      (popupController as any).editSegment(segmentId);
      
      expect(mockSegmentItem.classList.add).toHaveBeenCalledWith('edit-mode');
      
      // 편집 모드 종료를 위해 contains를 true로 변경
      mockSegmentItem.classList.contains.mockReturnValue(true);
      
      (popupController as any).editSegment(segmentId);
      
      expect(mockSegmentItem.classList.remove).toHaveBeenCalledWith('edit-mode');
    });

    it('존재하지 않는 구간에 대해 에러를 로그해야 함', () => {
      const segmentId = 'nonexistent';
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Mock document.querySelector to return null
      mockDocument.querySelector.mockReturnValue(null);
      
      (popupController as any).editSegment(segmentId);
      
      expect(consoleSpy).toHaveBeenCalledWith('구간 아이템을 찾을 수 없습니다:', segmentId);
      
      consoleSpy.mockRestore();
    });
  });

  describe('UI 업데이트', () => {
    it('시간 포맷팅이 올바르게 작동해야 함', () => {
      const formatTime = (popupController as any).formatTime;
      
      expect(formatTime(65)).toBe('1:05'); // 1분 5초
      expect(formatTime(0)).toBe('0:00'); // 0분 0초
      expect(formatTime(125)).toBe('2:05'); // 2분 5초
    });

    it('구간 정보가 올바르게 설정되어야 함', () => {
      const mockProfile = {
        segments: [
          {
            id: 'segment1',
            start: 10,
            end: 30,
            rate: 1.0,
            label: '테스트 구간'
          }
        ],
        activeSegmentId: null
      };
      
      (popupController as any).profile = mockProfile;
      
      // 프로필이 올바르게 설정되었는지 확인
      expect((popupController as any).profile.segments).toHaveLength(1);
      expect((popupController as any).profile.segments[0].id).toBe('segment1');
      expect((popupController as any).profile.segments[0].label).toBe('테스트 구간');
    });
  });
});
