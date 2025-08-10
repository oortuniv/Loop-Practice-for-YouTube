export function getVideoElement(): HTMLVideoElement | null {
  return document.querySelector('video');
}

export function getVideoIdFromUrl(url = location.href): string | null {
  try {
    const u = new URL(url);
    
    // youtu.be 형식
    if (u.hostname === 'youtu.be') {
      const path = u.pathname.slice(1);
      return path || null;
    }
    
    // youtube.com 형식
    if (u.hostname.includes('youtube.com')) {
      const videoId = u.searchParams.get('v');
      return videoId || null;
    }
    
    return null;
  } catch {
    return null;
  }
}

export function isYouTubeWatchPage(): boolean {
  const videoId = getVideoIdFromUrl();
  return videoId !== null && !location.pathname.includes('/shorts');
}

export function waitForVideoElement(): Promise<HTMLVideoElement> {
  return new Promise((resolve) => {
    const video = getVideoElement();
    if (video) {
      resolve(video);
      return;
    }

    const observer = new MutationObserver(() => {
      const video = getVideoElement();
      if (video) {
        observer.disconnect();
        resolve(video);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  });
}

export function onYouTubeNavigation(callback: () => void): void {
  // YouTube SPA 네비게이션 감지
  let currentUrl = location.href;
  
  const checkNavigation = () => {
    if (location.href !== currentUrl) {
      currentUrl = location.href;
      callback();
    }
  };

  // popstate 이벤트 (브라우저 뒤/앞 버튼)
  window.addEventListener('popstate', checkNavigation);
  
  // pushstate/replacestate 감지
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function(...args) {
    originalPushState.apply(history, args);
    setTimeout(checkNavigation, 0);
  };
  
  history.replaceState = function(...args) {
    originalReplaceState.apply(history, args);
    setTimeout(checkNavigation, 0);
  };
  
  // YouTube 내부 네비게이션 이벤트 (선택적)
  document.addEventListener('yt-navigate-finish', checkNavigation);
} 