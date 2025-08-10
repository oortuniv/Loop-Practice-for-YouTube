import { describe, it, expect } from 'vitest';
import { clamp, generateId, formatTime, isInputElement } from './utils';

describe('Utils', () => {
  describe('clamp', () => {
    it('should clamp value between min and max', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
      expect(clamp(0, 0, 10)).toBe(0);
      expect(clamp(10, 0, 10)).toBe(10);
    });
  });

  describe('generateId', () => {
    it('should generate unique ids', () => {
      const id1 = generateId();
      const id2 = generateId();
      
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(0);
    });
  });

  describe('formatTime', () => {
    it('should format seconds to MM:SS', () => {
      expect(formatTime(0)).toBe('0:00');
      expect(formatTime(30)).toBe('0:30');
      expect(formatTime(60)).toBe('1:00');
      expect(formatTime(90)).toBe('1:30');
      expect(formatTime(125)).toBe('2:05');
      expect(formatTime(3600)).toBe('60:00');
    });
  });

  describe('isInputElement', () => {
    it('should identify input elements correctly', () => {
      // 기본적인 태그 이름 기반 테스트
      const mockInput = { tagName: 'INPUT', contentEditable: false, isContentEditable: false } as any;
      const mockTextarea = { tagName: 'TEXTAREA', contentEditable: false, isContentEditable: false } as any;
      const mockSelect = { tagName: 'SELECT', contentEditable: false, isContentEditable: false } as any;
      const mockDiv = { tagName: 'DIV', contentEditable: false, isContentEditable: false } as any;
      const mockContentEditable = { tagName: 'DIV', contentEditable: 'true', isContentEditable: true } as any;
      
      expect(isInputElement(mockInput)).toBe(true);
      expect(isInputElement(mockTextarea)).toBe(true);
      expect(isInputElement(mockSelect)).toBe(true);
      expect(isInputElement(mockDiv)).toBe(false);
      expect(isInputElement(mockContentEditable)).toBe(true);
    });
  });
}); 