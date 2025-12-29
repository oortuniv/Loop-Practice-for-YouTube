// YouTube 페이지에 UI를 삽입하는 모듈

export class YouTubeUI {
  private container?: HTMLElement;
  private shadowRoot?: ShadowRoot;

  constructor() {
    console.log('YouTubeUI 생성');
  }

  /**
   * YouTube 페이지에 UI 컨테이너를 주입합니다.
   * 재생목록이 있는 위치(#secondary) 상단에 배치됩니다.
   */
  async inject(): Promise<HTMLElement | null> {
    // 먼저 기존에 남아있는 모든 looptube 컨테이너 제거
    this.removeAllContainers();

    // 이미 주입된 경우 기존 컨테이너 반환
    if (this.container && document.body.contains(this.container)) {
      console.log('UI 컨테이너가 이미 존재함');
      return this.container;
    }

    // YouTube의 secondary 컬럼 찾기 (재생목록이 있는 영역)
    const secondary = await this.waitForSecondary();
    if (!secondary) {
      console.log('YouTube secondary 영역을 찾을 수 없음');
      return null;
    }

    // 컨테이너 생성
    this.container = document.createElement('div');
    this.container.id = 'looptube-container';
    this.container.style.cssText = `
      width: 100%;
      margin-bottom: 16px;
      position: relative;
      z-index: 100;
    `;

    // Shadow DOM 사용하여 스타일 격리
    this.shadowRoot = this.container.attachShadow({ mode: 'open' });

    // secondary의 첫 번째 자식으로 삽입
    secondary.insertBefore(this.container, secondary.firstChild);

    console.log('UI 컨테이너 주입 완료');
    return this.container;
  }

  /**
   * 페이지에 남아있는 모든 looptube 컨테이너를 제거합니다.
   */
  private removeAllContainers() {
    const containers = document.querySelectorAll('#looptube-container');
    containers.forEach(container => {
      if (container.parentNode) {
        container.parentNode.removeChild(container);
        console.log('기존 looptube 컨테이너 제거됨');
      }
    });
  }

  /**
   * YouTube의 #secondary 요소가 로드될 때까지 기다립니다.
   */
  private async waitForSecondary(maxAttempts = 50): Promise<HTMLElement | null> {
    for (let i = 0; i < maxAttempts; i++) {
      const secondary = document.querySelector<HTMLElement>('#secondary');
      if (secondary) {
        console.log(`#secondary 요소 발견 (${i + 1}번째 시도)`);
        return secondary;
      }

      // 100ms 대기
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.error('#secondary 요소를 찾을 수 없음 (최대 시도 횟수 초과)');
    return null;
  }

  /**
   * UI의 HTML 콘텐츠를 렌더링합니다.
   */
  render(html: string, styles: string) {
    if (!this.shadowRoot) {
      console.error('Shadow root가 없음');
      return;
    }

    this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      ${html}
    `;

    console.log('UI 렌더링 완료');
  }

  /**
   * Shadow DOM 내부의 요소를 선택합니다.
   */
  querySelector<T extends Element>(selector: string): T | null {
    return this.shadowRoot?.querySelector<T>(selector) || null;
  }

  /**
   * Shadow DOM 내부의 모든 요소를 선택합니다.
   */
  querySelectorAll<T extends Element>(selector: string): NodeListOf<T> {
    return this.shadowRoot?.querySelectorAll<T>(selector) || document.querySelectorAll<T>('never-match');
  }

  /**
   * 이벤트 리스너를 추가합니다.
   */
  addEventListener(selector: string, event: string, handler: EventListener) {
    const element = this.querySelector(selector);
    if (element) {
      element.addEventListener(event, handler);
    } else {
      console.warn(`요소를 찾을 수 없음: ${selector}`);
    }
  }

  /**
   * UI를 제거합니다.
   */
  remove() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
      console.log('UI 컨테이너 제거 완료');
    }
    this.container = undefined;
    this.shadowRoot = undefined;
  }

  /**
   * 컨테이너가 DOM에 존재하는지 확인합니다.
   */
  isAttached(): boolean {
    return !!(this.container && document.body.contains(this.container));
  }
}
