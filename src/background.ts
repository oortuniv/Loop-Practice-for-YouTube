// Background service worker for YouTube Loop & Practice Extension

// 명령어 처리
chrome.commands.onCommand.addListener(async (command) => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab?.id || !tab.url) {
      console.warn('활성 탭을 찾을 수 없습니다');
      return;
    }
    
    // YouTube watch 페이지인지 확인
    const isYouTubeWatch = tab.url.includes('youtube.com/watch') || tab.url.includes('youtu.be/');
    if (!isYouTubeWatch) {
      console.warn('YouTube watch 페이지가 아닙니다');
      return;
    }
    
    // content script에 명령어 전달
    await chrome.tabs.sendMessage(tab.id, { 
      type: 'COMMAND', 
      command 
    });
    
  } catch (error) {
    console.error('명령어 처리 실패:', error);
  }
});

// 팝업에서 메시지 처리 (필요시)
chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  // 향후 팝업 관련 메시지 처리
  console.log('Background received message:', message);
});

// 확장프로그램 설치/업데이트 시 초기화
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('YouTube Loop & Practice 확장프로그램이 설치되었습니다');
  } else if (details.reason === 'update') {
    console.log('YouTube Loop & Practice 확장프로그램이 업데이트되었습니다');
  }
}); 