import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getVideoIdFromUrl, isYouTubeWatchPage } from './youtube';

describe('YouTube Utils', () => {
  let originalLocation: Location;

  beforeEach(() => {
    originalLocation = window.location;
    // @ts-ignore
    delete window.location;
  });

  afterEach(() => {
    // @ts-ignore
    window.location = originalLocation;
  });

  describe('getVideoIdFromUrl', () => {
    it('should extract video ID from youtube.com URL', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s';
      expect(getVideoIdFromUrl(url)).toBe('dQw4w9WgXcQ');
    });

    it('should extract video ID from youtu.be URL', () => {
      const url = 'https://youtu.be/dQw4w9WgXcQ';
      expect(getVideoIdFromUrl(url)).toBe('dQw4w9WgXcQ');
    });

    it('should return null for invalid URLs', () => {
      expect(getVideoIdFromUrl('https://www.google.com')).toBeNull();
      expect(getVideoIdFromUrl('https://youtube.com')).toBeNull();
      expect(getVideoIdFromUrl('invalid-url')).toBeNull();
    });

    it('should return null for empty video ID', () => {
      expect(getVideoIdFromUrl('https://www.youtube.com/watch?v=')).toBeNull();
      expect(getVideoIdFromUrl('https://youtu.be/')).toBeNull();
    });
  });

  describe('isYouTubeWatchPage', () => {
    it('should return true for youtube.com/watch URLs', () => {
      // @ts-ignore
      window.location = {
        href: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        pathname: '/watch'
      };
      expect(isYouTubeWatchPage()).toBe(true);
    });

    it('should return true for youtu.be URLs', () => {
      // @ts-ignore
      window.location = {
        href: 'https://youtu.be/dQw4w9WgXcQ',
        pathname: '/dQw4w9WgXcQ'
      };
      expect(isYouTubeWatchPage()).toBe(true);
    });

    it('should return false for YouTube shorts', () => {
      // @ts-ignore
      window.location = {
        href: 'https://www.youtube.com/shorts/dQw4w9WgXcQ',
        pathname: '/shorts/dQw4w9WgXcQ'
      };
      expect(isYouTubeWatchPage()).toBe(false);
    });

    it('should return false for non-YouTube URLs', () => {
      // @ts-ignore
      window.location = {
        href: 'https://www.google.com',
        pathname: '/'
      };
      expect(isYouTubeWatchPage()).toBe(false);
    });
  });
}); 