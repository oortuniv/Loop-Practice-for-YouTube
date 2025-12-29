import { vi } from 'vitest';

// Test setup for Loop Practice for YouTube Extension

// Mock Chrome Extension APIs
global.chrome = {
  runtime: {
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    },
    sendMessage: vi.fn()
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn()
  },
  storage: {
    sync: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined)
    }
  },
  commands: {
    onCommand: {
      addListener: vi.fn()
    }
  },
  action: {
    onClicked: {
      addListener: vi.fn()
    }
  }
} as any;

// Mock Web Audio API
global.AudioContext = class {
  currentTime = 0;
  createOscillator() {
    return {
      frequency: { value: 0 },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn()
    };
  }
  createGain() {
    return {
      gain: { value: 0 },
      connect: vi.fn()
    };
  }
  createAnalyser() {
    return {
      fftSize: 0,
      frequencyBinCount: 0,
      connect: vi.fn(),
      getByteFrequencyData: vi.fn()
    };
  }
  createMediaStreamSource() {
    return {
      connect: vi.fn()
    };
  }
  suspend() {}
  resume() {}
} as any;

// Mock HTMLMediaElement
Object.defineProperty(global.HTMLMediaElement.prototype, 'currentTime', {
  writable: true,
  value: 0
});

Object.defineProperty(global.HTMLMediaElement.prototype, 'duration', {
  writable: true,
  value: 100
});

Object.defineProperty(global.HTMLMediaElement.prototype, 'paused', {
  writable: true,
  value: true
});

Object.defineProperty(global.HTMLMediaElement.prototype, 'playbackRate', {
  writable: true,
  value: 1.0
});

global.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
global.HTMLMediaElement.prototype.pause = vi.fn();
global.HTMLMediaElement.prototype.addEventListener = vi.fn();
global.HTMLMediaElement.prototype.removeEventListener = vi.fn();

// Mock captureStream
Object.defineProperty(global.HTMLMediaElement.prototype, 'captureStream', {
  value: vi.fn().mockReturnValue({
    getTracks: vi.fn().mockReturnValue([])
  })
});

// Mock MutationObserver
global.MutationObserver = class {
  constructor(_callback: any) {}
  observe = vi.fn();
  disconnect = vi.fn();
} as any;

// Mock setTimeout and setInterval
const originalSetTimeout = global.setTimeout;
const originalSetInterval = global.setInterval;

global.setTimeout = vi.fn((callback: any, delay: number) => {
  return originalSetTimeout(callback, delay);
}) as any;

global.setInterval = vi.fn((callback: any, delay: number) => {
  return originalSetInterval(callback, delay);
}) as any; 