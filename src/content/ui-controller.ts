// Content Script UI 컨트롤러
import { VideoProfile, LoopSegment } from '../types';
import { YouTubeUI } from './ui';
import { barsToSeconds, secondsToBars } from '../utils';

export class UIController {
  private ui: YouTubeUI;
  private profile?: VideoProfile;
  private onCommand?: (command: string, data?: any) => void;
  private isCollapsed: boolean = false;
  private isDarkTheme: boolean = false;
  private collapsedSegments: Map<string, boolean> = new Map(); // 세그먼트별 접힌 상태 저장
  private draggedSegmentId: string | null = null; // 드래그 중인 세그먼트 ID
  private globalSyncMetronomeEnabled: boolean = false; // 글로벌 싱크 메트로놈 상태

  constructor() {
    this.ui = new YouTubeUI();
    this.detectTheme();
    this.observeThemeChanges();
  }

  /**
   * UI를 초기화하고 렌더링합니다.
   */
  async init(profile: VideoProfile, onCommand: (command: string, data?: any) => void) {
    this.profile = profile;
    this.onCommand = onCommand;

    // UI 컨테이너 주입
    const container = await this.ui.inject();
    if (!container) {
      console.error('UI 주입 실패');
      return;
    }

    // 저장된 접힌 상태 로드
    this.loadCollapsedState();

    // HTML과 스타일 렌더링
    this.render();

    // 이벤트 리스너 설정
    this.setupEventListeners();

    console.log('UIController 초기화 완료');
  }

  /**
   * UI를 렌더링합니다.
   */
  private render() {
    // 렌더링 전 스크롤 위치 저장
    const segmentsList = this.ui.querySelector('.segments-list');
    const scrollTop = segmentsList?.scrollTop || 0;

    const html = this.getHTML();
    const styles = this.getStyles();
    this.ui.render(html, styles);

    // 렌더링 후 스크롤 위치 복원
    if (scrollTop > 0) {
      const newSegmentsList = this.ui.querySelector('.segments-list');
      if (newSegmentsList) {
        newSegmentsList.scrollTop = scrollTop;
      }
    }
  }

  /**
   * 프로필을 업데이트하고 UI를 다시 렌더링합니다.
   */
  updateProfile(profile: VideoProfile) {
    this.profile = profile;
    this.render();
    this.setupEventListeners(); // 이벤트 리스너 재설정
  }

  /**
   * YouTube 테마를 감지합니다.
   */
  private detectTheme() {
    const html = document.documentElement;
    this.isDarkTheme = html.hasAttribute('dark') || html.getAttribute('data-color-scheme') === 'dark';
  }

  /**
   * 테마 변경을 감지합니다.
   */
  private observeThemeChanges() {
    const html = document.documentElement;
    const observer = new MutationObserver(() => {
      const wasDark = this.isDarkTheme;
      this.detectTheme();
      if (wasDark !== this.isDarkTheme) {
        this.render();
        this.setupEventListeners();
      }
    });

    observer.observe(html, {
      attributes: true,
      attributeFilter: ['dark', 'data-color-scheme']
    });
  }

  /**
   * 메트로놈이 해당 세그먼트에서 활성화되어 있는지 확인합니다.
   */
  private isMetronomeActive(segmentId: string): boolean {
    const segment = this.profile?.segments.find(s => s.id === segmentId);
    return segment?.metronomeEnabled || false;
  }

  /**
   * 글로벌 싱크 메트로놈이 활성화되어 있는지 확인합니다.
   */
  private isGlobalSyncMetronomeActive(): boolean {
    return this.globalSyncMetronomeEnabled;
  }

  /**
   * 메트로놈 버튼의 툴팁 텍스트를 반환합니다.
   */
  private getMetronomeTooltip(isLoopActive: boolean): string {
    const hasTempo = !!this.profile?.tempo;
    const hasTimeSignature = !!this.profile?.timeSignature;

    if (!hasTempo && !hasTimeSignature) {
      return 'Set BPM and Time Signature to enable metronome';
    }

    if (!hasTempo) {
      return 'Set BPM to enable metronome';
    }

    if (!hasTimeSignature) {
      return 'Set Time Signature to enable metronome';
    }

    if (!isLoopActive) {
      return 'Toggle metronome (will play when loop is active)';
    }

    // 메트로놈 사용 가능한 상태
    return 'Toggle metronome click sound';
  }

  /**
   * 싱크 오프셋을 포맷팅합니다 (xx.xxx 형식).
   */
  private formatSyncOffset(offset: number): string {
    return offset.toFixed(3);
  }

  /**
   * 메트로놈 상태를 업데이트합니다.
   * (Per-segment 메트로놈 시스템에서는 각 세그먼트가 자체 상태를 가지므로 이 메서드는 더 이상 필요하지 않음)
   */
  setMetronomeActive(_segmentId: string | null) {
    // Per-segment 메트로놈에서는 render()를 호출하여 UI만 업데이트
    this.render();
    this.setupEventListeners();
  }

  /**
   * Bar select HTML을 생성합니다 (End 시간용 - Start로부터의 상대 길이).
   * BPM/박자표가 설정되지 않은 경우 빈 문자열을 반환합니다.
   */
  private getBarInputHTML(segmentId: string, startTime: number, endTime: number): string {
    if (!this.profile?.tempo || !this.profile?.timeSignature) {
      return '';
    }

    const bpm = this.profile.tempo;
    const timeSignature = this.profile.timeSignature;
    const duration = endTime - startTime;
    const bars = secondsToBars(duration, bpm, timeSignature);
    const roundedBars = Math.max(1, Math.min(16, Math.round(bars))); // 1-16 범위로 제한

    // 1부터 16까지 모든 양의 정수 옵션 생성
    const options = Array.from({ length: 16 }, (_, i) => {
      const barCount = i + 1;
      const selected = barCount === roundedBars ? 'selected' : '';
      return `<option value="${barCount}" ${selected}>${barCount} bar${barCount > 1 ? 's' : ''}</option>`;
    }).join('');

    return `
      <select class="bar-select" data-segment-id="${segmentId}">
        ${options}
      </select>
    `;
  }

  /**
   * 스마트 듀레이션 드롭다운 옵션을 생성합니다.
   * BPM/박자표 설정 여부에 따라 bar 옵션을 표시하거나 숨깁니다.
   */
  private getDurationOptions(): string {
    const hasBpmOrTimeSignature = this.profile?.tempo || this.profile?.timeSignature;

    if (!hasBpmOrTimeSignature) {
      // BPM/박자표 미설정: 초 단위만 표시
      return `
        <option value="5">5 seconds</option>
        <option value="10" selected>10 seconds</option>
        <option value="20">20 seconds</option>
        <option value="30">30 seconds</option>
        <option value="60">60 seconds</option>
        <option disabled>─ Set BPM for bar mode ─</option>
      `;
    }

    // BPM/박자표 설정됨: Bar 옵션 우선 표시
    const bpm = this.profile?.tempo || 120;
    const timeSignature = this.profile?.timeSignature || '4/4';

    // 1부터 16까지 모든 양의 정수 bar 옵션 생성
    const barOptions = Array.from({ length: 16 }, (_, i) => {
      const bars = i + 1;
      const seconds = barsToSeconds(bars, bpm, timeSignature);
      const label = bars === 1 ? '1 bar' : `${bars} bars`;
      const selected = bars === 8 ? 'selected' : ''; // 기본값 8 bars
      return `<option value="bar:${bars}" ${selected}>${label} (${seconds.toFixed(1)}s)</option>`;
    }).join('');

    return `
      <optgroup label="Bars (Recommended)">
        ${barOptions}
      </optgroup>
      <optgroup label="Seconds">
        <option value="5">5 seconds</option>
        <option value="10">10 seconds</option>
        <option value="20">20 seconds</option>
        <option value="30">30 seconds</option>
        <option value="60">60 seconds</option>
      </optgroup>
    `;
  }

  /**
   * HTML 콘텐츠를 생성합니다.
   */
  private getHTML(): string {
    if (!this.profile) return '';

    const segmentsHTML = this.profile.segments.map(segment => this.getSegmentHTML(segment)).join('');
    const chevronIcon = this.isCollapsed
      ? '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" fill="currentColor"/></svg>'
      : '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" fill="currentColor"/></svg>';

    const videoTitle = this.profile.videoTitle || 'YouTube Video';
    const channelName = this.profile.channelName || 'Unknown Channel';
    const tempo = this.profile.tempo;
    const timeSignature = this.profile.timeSignature;

    return `
      <div class="looptube-panel ${this.isCollapsed ? 'collapsed' : ''}">
        <div class="header" id="panelHeader">
          <div class="header-left">
            <button class="toggle-btn" id="toggleBtn" aria-label="${this.isCollapsed ? 'Expand' : 'Collapse'}">
              ${chevronIcon}
            </button>
            <h1>Loop Practice for YouTube</h1>
          </div>
          <div class="loop-count">${this.profile.segments.length} loops</div>
        </div>

        <div class="panel-content" style="display: ${this.isCollapsed ? 'none' : 'block'}">
          <!-- Video Info Card -->
          <div class="video-info-section">
            <div class="video-info">
              <div class="video-title" title="${videoTitle}">${videoTitle}</div>
              <div class="channel-name">${channelName}</div>
            </div>

            <div class="global-settings">
              <div class="settings-row">
                <div class="setting-group">
                  <label>Tempo (BPM):</label>
                  <div class="tempo-controls">
                    <input type="text" id="tempoInput" class="tempo-input" value="${tempo || '---'}" data-placeholder="---">
                    <button class="btn btn-small btn-tap" id="tapTempo">TAP</button>
                  </div>
                </div>

                <div class="setting-group">
                  <label>Time Signature:</label>
                  <select id="timeSignature" class="time-signature-select">
                    <option value="" ${!timeSignature ? 'selected' : ''}>---</option>
                    <option value="2/4" ${timeSignature === '2/4' ? 'selected' : ''}>2/4</option>
                    <option value="3/4" ${timeSignature === '3/4' ? 'selected' : ''}>3/4</option>
                    <option value="4/4" ${timeSignature === '4/4' ? 'selected' : ''}>4/4</option>
                    <option value="5/4" ${timeSignature === '5/4' ? 'selected' : ''}>5/4</option>
                    <option value="3/8" ${timeSignature === '3/8' ? 'selected' : ''}>3/8</option>
                    <option value="6/8" ${timeSignature === '6/8' ? 'selected' : ''}>6/8</option>
                    <option value="7/8" ${timeSignature === '7/8' ? 'selected' : ''}>7/8</option>
                    <option value="9/8" ${timeSignature === '9/8' ? 'selected' : ''}>9/8</option>
                    <option value="12/8" ${timeSignature === '12/8' ? 'selected' : ''}>12/8</option>
                    <option value="6/4" ${timeSignature === '6/4' ? 'selected' : ''}>6/4</option>
                  </select>
                </div>
              </div>

              <!-- Global Sync 기능 임시 숨김 (로직은 유지) -->
              <!--
              <div class="setting-group global-sync-group" style="display: none;">
                <label>Global Sync:</label>
                <div class="sync-controls">
                  <button
                    class="btn-metronome ${this.isGlobalSyncMetronomeActive() ? 'active' : ''}"
                    id="globalSyncMetronome"
                    ${!tempo || !timeSignature ? 'disabled' : ''}
                    title="Toggle metronome for global sync adjustment"
                  >
                    ♪
                  </button>
                  <input
                    type="text"
                    id="globalSyncInput"
                    class="sync-input"
                    value="${this.formatSyncOffset(this.profile.globalMetronomeOffset || 0)}"
                    ${!tempo || !timeSignature ? 'disabled' : ''}
                  >
                  <span class="sync-unit">s</span>
                  <button
                    class="btn btn-small btn-sync"
                    id="syncGlobal"
                    ${!tempo || !timeSignature ? 'disabled' : ''}
                    title="Apply global sync to all loops"
                  >
                    SYNC
                  </button>
                </div>
              </div>
              -->
            </div>
          </div>

          <!-- Loop Management Card -->
          <div class="controls-section">
            <div class="control-group">
              <label>Loop Management:</label>
              <div class="segment-management">
                <input
                  type="text"
                  id="segmentLabel"
                  class="segment-input label-input"
                  list="labelPresets"
                  placeholder="Loop name..."
                />
                <datalist id="labelPresets">
                  <option value="Intro">
                  <option value="Verse">
                  <option value="Chorus">
                  <option value="Bridge">
                  <option value="Outro">
                </datalist>
                <select id="loopDuration" class="segment-input duration-select">
                  ${this.getDurationOptions()}
                </select>
                <button class="btn btn-small btn-primary" id="createSegment">Create</button>
              </div>
            </div>
          </div>

          <div class="segments-list" id="segmentsList">
            ${segmentsHTML || '<div class="no-loops">No loops yet. Create one!</div>'}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 세그먼트 HTML을 생성합니다.
   */
  private getSegmentHTML(segment: LoopSegment): string {
    const isActive = segment.id === this.profile?.activeSegmentId;
    const isCollapsed = this.collapsedSegments.get(segment.id) || false;
    const safeLabel = segment.label || 'Loop';
    const safeStart = typeof segment.start === 'number' && !isNaN(segment.start) ? segment.start : 0;
    const safeEnd = typeof segment.end === 'number' && !isNaN(segment.end) ? segment.end : 10;
    const safeRate = typeof segment.rate === 'number' && !isNaN(segment.rate) ? segment.rate : 1.0;

    const collapseIcon = isCollapsed
      ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>'
      : '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>';

    return `
      <div class="segment-item ${isActive ? 'active' : ''} ${isCollapsed ? 'collapsed' : ''}" data-segment-id="${segment.id}" draggable="true">
        <div class="segment-header">
          <button class="collapse-toggle-btn" data-segment-id="${segment.id}" data-action="toggle-collapse" title="${isCollapsed ? 'Expand' : 'Collapse'}">
            ${collapseIcon}
          </button>
          <div class="segment-label">
            <span class="label-text">${safeLabel}</span>
            <button class="label-edit-btn" data-segment-id="${segment.id}" data-action="edit-label">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
              </svg>
            </button>
          </div>
          ${isCollapsed ? `
          <div class="segment-time-range">${this.formatTime(safeStart)} ~ ${this.formatTime(safeEnd)}</div>
          <button class="btn btn-loop-compact ${isActive ? 'active' : ''}" data-segment-id="${segment.id}" data-action="jump-and-activate" title="Activate loop">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
            </svg>
          </button>
          ` : ''}
          <div class="menu-container">
            <button class="btn-menu" data-segment-id="${segment.id}" data-action="toggle-menu" title="More options">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
              </svg>
            </button>
            <div class="menu-dropdown" data-segment-id="${segment.id}" style="display: none;">
              <button class="menu-item menu-delete" data-segment-id="${segment.id}" data-action="delete">Delete</button>
            </div>
          </div>
        </div>
        <div class="segment-body" style="${isCollapsed ? 'display: none;' : ''}">
          <div class="segment-controls">
            <div class="time-input-group">
              <label>Start:</label>
              <input type="text" class="time-input" data-segment-id="${segment.id}" data-time-type="start"
                     value="${this.formatTime(safeStart)}" placeholder="0:00.000">
              <button class="time-set-btn" data-segment-id="${segment.id}" data-action="set-start-time" title="Set to current time">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                </svg>
              </button>
            </div>
            <div class="time-input-group">
              <label>End:</label>
              <input type="text" class="time-input" data-segment-id="${segment.id}" data-time-type="end"
                     value="${this.formatTime(safeEnd)}" placeholder="0:00.000">
              ${this.getBarInputHTML(segment.id, safeStart, safeEnd)}
              <button class="time-set-btn" data-segment-id="${segment.id}" data-action="set-end-time" title="Set to current time">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                </svg>
              </button>
            </div>
            <div class="rate-control-group">
              <label>Speed:</label>
              <button class="rate-btn" data-segment-id="${segment.id}" data-action="decrease-rate">-</button>
              <div class="rate-input-container">
                <input type="text" class="rate-input" data-segment-id="${segment.id}"
                       value="${Math.round(safeRate * 100)}" readonly>
                <span class="rate-unit">%</span>
              </div>
              <button class="rate-btn" data-segment-id="${segment.id}" data-action="increase-rate">+</button>
            </div>
          </div>
          <div class="segment-actions">
            <div class="action-buttons-vertical">
              <button class="btn btn-loop ${isActive ? 'active' : ''}" data-segment-id="${segment.id}" data-action="jump-and-activate" title="Activate loop">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                  <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                </svg>
              </button>
              <!-- 메트로놈 버튼 임시 숨김 (로직은 유지) -->
              <!--
              <button class="btn btn-metronome ${this.isMetronomeActive(segment.id) ? 'active' : ''}"
                      data-segment-id="${segment.id}"
                      data-action="toggle-metronome"
                      ${!this.profile?.tempo || !this.profile?.timeSignature ? 'disabled' : ''}
                      title="${this.getMetronomeTooltip(isActive)}">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M12 2L6 20h12L12 2zm0 3.5l3.5 12.5h-7L12 5.5z"/>
                  <path d="M12 6v8"/>
                  <circle cx="12" cy="10" r="1.5"/>
                </svg>
              </button>
              -->
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * CSS 스타일을 생성합니다.
   */
  private getStyles(): string {
    // 테마에 따른 색상 변수
    const bgPrimary = this.isDarkTheme ? '#212121' : '#fff';
    const bgSecondary = this.isDarkTheme ? '#0f0f0f' : '#f9f9f9';
    const textPrimary = this.isDarkTheme ? '#fff' : '#030303';
    const textSecondary = this.isDarkTheme ? '#aaa' : '#606060';
    const borderColor = this.isDarkTheme ? '#3f3f3f' : '#e5e5e5';
    const hoverBg = this.isDarkTheme ? '#3f3f3f' : '#f2f2f2';
    const inputBg = this.isDarkTheme ? '#121212' : '#fff';
    const inputBorder = this.isDarkTheme ? '#303030' : '#ccc';

    return `
      * {
        box-sizing: border-box;
      }

      .looptube-panel {
        font-family: Roboto, Arial, sans-serif;
        background: ${bgPrimary};
        border-radius: 12px;
        padding: 0;
        box-shadow: none;
        border: 1px solid ${borderColor};
      }

      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid ${borderColor};
        cursor: pointer;
        user-select: none;
      }

      .header-left {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
      }

      .toggle-btn {
        background: transparent;
        border: none;
        padding: 0;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        color: ${textPrimary};
        transition: background-color 0.2s;
        border-radius: 50%;
      }

      .toggle-btn:hover {
        background: ${hoverBg};
      }

      .header h1 {
        margin: 0;
        font-size: 16px;
        font-weight: 500;
        color: ${textPrimary};
      }

      .loop-count {
        background: ${this.isDarkTheme ? '#3f3f3f' : '#f2f2f2'};
        color: ${textPrimary};
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 400;
      }

      .panel-content {
        padding: 12px 16px;
      }

      /* Video Info Section */
      .video-info-section {
        background: ${bgSecondary};
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 12px;
        border: 1px solid ${borderColor};
      }

      .video-info {
        margin-bottom: 12px;
        padding-bottom: 12px;
        border-bottom: 1px solid ${borderColor};
      }

      .video-title {
        font-size: 14px;
        font-weight: 500;
        color: ${textPrimary};
        margin-bottom: 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .channel-name {
        font-size: 12px;
        color: ${textSecondary};
      }

      .global-settings {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .settings-row {
        display: flex;
        gap: 12px;
      }

      .setting-group {
        flex: 1;
      }

      .setting-group label {
        display: block;
        font-size: 11px;
        font-weight: 400;
        color: ${textSecondary};
        margin-bottom: 6px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .tempo-controls {
        display: flex;
        gap: 6px;
        align-items: stretch;
      }

      .tempo-input {
        flex: 1;
        padding: 6px 10px;
        border: 1px solid ${inputBorder};
        border-radius: 2px;
        font-size: 13px;
        background: ${inputBg};
        color: ${textPrimary};
        cursor: ns-resize;
      }

      .tempo-input:focus {
        outline: none;
        border-color: #065fd4;
      }

      .tempo-input::-webkit-inner-spin-button,
      .tempo-input::-webkit-outer-spin-button {
        opacity: 1;
      }

      .btn-tap {
        flex: 0 0 auto;
        background: ${this.isDarkTheme ? '#3f3f3f' : '#e0e0e0'};
        color: ${textPrimary};
        font-weight: 600;
        padding: 6px 12px;
      }

      .btn-tap:hover {
        background: ${this.isDarkTheme ? '#505050' : '#d0d0d0'};
      }

      .btn-tap:active {
        background: #065fd4;
        color: white;
      }

      .time-signature-select {
        width: 100%;
        padding: 6px 10px;
        border: 1px solid ${inputBorder};
        border-radius: 2px;
        font-size: 13px;
        background: ${inputBg};
        color: ${textPrimary};
      }

      .time-signature-select:focus {
        outline: none;
        border-color: #065fd4;
      }

      .global-sync-group {
        /* Global sync는 이미 settings row 아래에 위치하므로 margin-top 불필요 */
      }

      .sync-controls {
        display: flex;
        gap: 4px;
        align-items: center;
      }

      .sync-input {
        flex: 1;
        padding: 6px 10px;
        border: 1px solid ${inputBorder};
        border-radius: 2px;
        font-size: 13px;
        background: ${inputBg};
        color: ${textPrimary};
        text-align: right;
        cursor: ns-resize;
        font-family: 'Roboto Mono', monospace;
      }

      .sync-input:focus {
        outline: none;
        border-color: #065fd4;
      }

      .sync-input:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .sync-unit {
        font-size: 12px;
        color: ${textSecondary};
        margin-right: 4px;
      }

      .btn-sync {
        flex: 0 0 auto;
        background: ${this.isDarkTheme ? '#3f3f3f' : '#e0e0e0'};
        color: ${textPrimary};
        font-weight: 600;
        padding: 6px 12px;
      }

      .btn-sync:hover:not(:disabled) {
        background: ${this.isDarkTheme ? '#505050' : '#d0d0d0'};
      }

      .btn-sync:active:not(:disabled) {
        background: #065fd4;
        color: white;
      }

      .btn-sync:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .controls-section {
        background: ${bgSecondary};
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 12px;
        border: 1px solid ${borderColor};
      }

      .control-group {
        margin-bottom: 0;
      }

      .control-group label {
        display: block;
        font-size: 12px;
        font-weight: 400;
        color: ${textSecondary};
        margin-bottom: 6px;
      }

      .segment-management {
        display: flex;
        gap: 6px;
        align-items: center;
      }

      .segment-input {
        flex: 1;
        padding: 6px 10px;
        border: 1px solid ${inputBorder};
        border-radius: 2px;
        font-size: 13px;
        background: ${inputBg};
        color: ${textPrimary};
      }

      .segment-input:focus {
        outline: none;
        border-color: #065fd4;
      }

      .duration-select {
        flex: 0 0 auto;
        width: 90px;
        margin-right: 0;
        font-size: 12px;
        padding: 6px 8px;
      }

      #createSegment {
        flex-shrink: 0;
        white-space: nowrap;
      }

      .btn {
        padding: 6px 12px;
        border: none;
        border-radius: 18px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .btn-small {
        padding: 6px 12px;
        font-size: 12px;
      }

      .btn-primary {
        background: #065fd4;
        color: white;
      }

      .btn-primary:hover {
        background: #0553c2;
      }

      .btn-secondary {
        background: ${this.isDarkTheme ? '#3f3f3f' : '#0000000d'};
        color: ${this.isDarkTheme ? '#fff' : '#030303'};
      }

      .btn-secondary:hover {
        background: ${this.isDarkTheme ? '#4f4f4f' : '#0000001a'};
      }

      .btn-loop {
        background: ${this.isDarkTheme ? '#3f3f3f' : '#f9f9f9'};
        color: ${textSecondary};
        border: 1px solid ${borderColor};
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 12px;
        border-radius: 8px;
        width: 100%;
        height: 100%;
        min-width: 48px;
      }

      .btn-loop:hover {
        background: ${this.isDarkTheme ? '#4f4f4f' : '#f2f2f2'};
      }

      .btn-loop.active {
        background: #065fd4;
        color: white;
        border-color: #065fd4;
      }

      .btn-loop svg {
        display: block;
      }

      .segments-list {
        max-height: 400px;
        overflow-y: auto;
        background: transparent;
        border-radius: 8px;
        padding: 0;
      }

      .no-loops {
        text-align: center;
        color: ${textSecondary};
        padding: 24px;
        font-size: 14px;
      }

      .segment-item {
        display: flex;
        flex-direction: column;
        padding: 12px;
        border-radius: 8px;
        margin-bottom: 8px;
        background: ${bgSecondary};
        transition: all 0.2s;
        border: 1px solid ${borderColor};
        cursor: default;
      }

      .segment-item:hover {
        background: ${hoverBg};
      }

      .segment-item.active {
        background: ${this.isDarkTheme ? '#0d3a72' : '#e8f0fe'};
        border: 1px solid #065fd4;
      }

      .segment-item.dragging {
        opacity: 0.5;
        cursor: default;
      }

      .segment-item.drag-over {
        border: 2px dashed #065fd4;
        background: ${this.isDarkTheme ? '#1a4d8f' : '#d2e3fc'};
      }

      .segment-header {
        display: flex;
        align-items: center;
        margin-bottom: 8px;
        gap: 8px;
      }

      .segment-item.collapsed {
        padding: 8px 12px;
      }

      .segment-item.collapsed .segment-header {
        margin-bottom: 0;
      }

      .collapse-toggle-btn {
        background: transparent;
        border: none;
        color: ${textSecondary};
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 4px;
        cursor: pointer;
        border-radius: 4px;
        transition: all 0.2s;
        flex-shrink: 0;
      }

      .collapse-toggle-btn:hover {
        background: ${this.isDarkTheme ? '#3f3f3f' : '#f0f0f0'};
        color: ${textPrimary};
      }

      .segment-time-range {
        font-size: 11px;
        color: ${textSecondary};
        font-family: 'Courier New', monospace;
        white-space: nowrap;
        margin-right: 8px;
      }

      .btn-loop-compact {
        background: ${this.isDarkTheme ? '#3f3f3f' : '#f9f9f9'};
        color: ${textSecondary};
        border: 1px solid ${borderColor};
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 6px;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
        flex-shrink: 0;
      }

      .btn-loop-compact:hover {
        background: ${this.isDarkTheme ? '#4f4f4f' : '#f2f2f2'};
      }

      .btn-loop-compact.active {
        background: #065fd4;
        color: white;
        border-color: #065fd4;
      }

      .segment-item.collapsed .segment-body {
        display: none !important;
      }

      .segment-body {
        display: flex;
        gap: 12px;
        align-items: stretch;
      }

      .segment-controls {
        display: flex;
        flex-direction: column;
        gap: 4px;
        flex: 1;
        min-width: 0;
        overflow: hidden;
      }

      .segment-label {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 500;
        font-size: 14px;
        color: ${textPrimary};
        flex: 1;
        min-width: 0;
      }

      .segment-label .label-text {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .label-edit-btn {
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 4px;
        transition: all 0.2s;
        border-radius: 50%;
        color: ${textSecondary};
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .label-edit-btn:hover {
        background: ${hoverBg};
        color: ${textPrimary};
      }

      .label-edit-btn svg {
        display: block;
      }

      .label-input {
        flex: 1;
        padding: 4px 8px;
        border: 1px solid ${inputBorder};
        border-radius: 2px;
        font-size: 11px;
        background: ${inputBg};
        color: ${textPrimary};
        cursor: pointer;
        appearance: none;
        -webkit-appearance: none;
        -moz-appearance: none;
      }

      .label-input:focus {
        outline: none;
        border-color: #065fd4;
      }

      .time-input-group {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        color: ${textSecondary};
        flex-wrap: nowrap;
      }

      .time-input-group label {
        flex: 0 0 38px;
        font-size: 11px;
        margin: 0;
        color: ${textSecondary};
      }

      .time-input {
        flex: 1;
        min-width: 70px;
        padding: 4px 6px;
        border: 1px solid ${inputBorder};
        border-radius: 2px;
        font-size: 11px;
        text-align: center;
        background: ${inputBg};
        color: ${textPrimary};
        font-family: 'Courier New', monospace;
        cursor: ns-resize;
        user-select: none;
      }

      .bar-select {
        flex: 0 0 70px;
        padding: 4px 4px;
        border: 1px solid ${inputBorder};
        border-radius: 2px;
        font-size: 10px;
        background: ${inputBg};
        color: ${textPrimary};
        cursor: pointer;
      }

      .bar-select:focus {
        outline: none;
        border-color: #065fd4;
      }

      .time-input:focus {
        outline: none;
        border-color: #065fd4;
        user-select: text;
        cursor: text;
      }

      .time-input.dragging {
        border-color: #065fd4;
        background: ${this.isDarkTheme ? '#1a1a1a' : '#f0f7ff'};
        cursor: ns-resize;
      }

      .time-set-btn {
        background: ${this.isDarkTheme ? '#3f3f3f' : '#e5e5e5'};
        color: ${textPrimary};
        border: none;
        border-radius: 50%;
        padding: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        flex-shrink: 0;
        width: 24px;
        height: 24px;
      }

      .time-set-btn:hover {
        background: ${this.isDarkTheme ? '#4f4f4f' : '#d0d0d0'};
      }

      .time-set-btn svg {
        display: block;
      }

      .rate-control-group {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        color: ${textSecondary};
      }

      .rate-control-group label {
        flex: 0 0 38px;
        margin: 0;
      }

      .rate-input-container {
        display: flex;
        align-items: center;
        gap: 4px;
        flex: 1;
        min-width: 50px;
      }

      .rate-btn {
        background: ${this.isDarkTheme ? '#3f3f3f' : '#e5e5e5'};
        color: ${textPrimary};
        border: none;
        border-radius: 2px;
        font-size: 12px;
        padding: 4px 8px;
        cursor: pointer;
        min-width: 24px;
        font-weight: 500;
      }

      .rate-btn:hover {
        background: ${this.isDarkTheme ? '#4f4f4f' : '#d0d0d0'};
      }

      .rate-input {
        flex: 1;
        padding: 4px 6px;
        border: 1px solid ${inputBorder};
        border-radius: 2px;
        font-size: 11px;
        text-align: center;
        min-width: 50px;
        background: ${inputBg};
        color: ${textPrimary};
        cursor: ns-resize;
        user-select: none;
        font-family: 'Courier New', monospace;
      }

      .rate-input:focus {
        outline: none;
        border-color: #065fd4;
      }

      .rate-input.dragging {
        border-color: #065fd4;
        background: ${this.isDarkTheme ? '#1a1a1a' : '#f0f7ff'};
        cursor: ns-resize;
      }

      /* number input 기본 스피너 제거 */
      .rate-input::-webkit-outer-spin-button,
      .rate-input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      .rate-input[type=number] {
        -moz-appearance: textfield;
      }

      .rate-unit {
        font-size: 11px;
        color: ${textSecondary};
      }

      .segment-actions {
        display: flex;
        align-items: stretch;
        min-width: 60px;
      }

      .action-buttons-vertical {
        display: flex;
        flex-direction: column;
        gap: 4px;
        width: 100%;
      }

      .btn-metronome {
        background: ${this.isDarkTheme ? '#3f3f3f' : '#f9f9f9'};
        color: ${textSecondary};
        border: 2px solid ${borderColor};
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 6px;
        border-radius: 8px;
        width: 100%;
        height: 32px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .btn-metronome:hover:not(:disabled) {
        background: ${this.isDarkTheme ? '#4f4f4f' : '#f2f2f2'};
      }

      .btn-metronome.active {
        background: ${this.isDarkTheme ? '#3f3f3f' : '#f9f9f9'};
        color: ${textPrimary};
        border-color: #8B6F47;
        border-width: 2px;
      }

      .btn-metronome:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .btn-metronome svg {
        display: block;
      }

      .menu-container {
        position: relative;
      }

      .btn-menu {
        background: transparent;
        border: none;
        padding: 4px;
        cursor: pointer;
        border-radius: 50%;
        transition: all 0.2s;
        color: ${textSecondary};
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .btn-menu:hover {
        background: ${this.isDarkTheme ? '#3f3f3f' : '#f2f2f2'};
        color: ${textPrimary};
      }

      .btn-menu svg {
        display: block;
      }

      .menu-dropdown {
        position: absolute;
        top: 100%;
        right: 0;
        margin-top: 4px;
        background: ${bgPrimary};
        border: 1px solid ${borderColor};
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        min-width: 120px;
        z-index: 1000;
        overflow: hidden;
      }

      .menu-item {
        display: block;
        width: 100%;
        padding: 10px 16px;
        background: transparent;
        border: none;
        text-align: left;
        font-size: 13px;
        color: ${textPrimary};
        cursor: pointer;
        transition: background-color 0.2s;
      }

      .menu-item:hover {
        background: ${hoverBg};
      }

      .menu-delete {
        color: ${this.isDarkTheme ? '#ff6b6b' : '#cc0000'};
      }

      .menu-delete:hover {
        background: ${this.isDarkTheme ? '#3f1f1f' : '#ffebee'};
      }

      /* 스크롤바 스타일 */
      .segments-list::-webkit-scrollbar {
        width: 8px;
      }

      .segments-list::-webkit-scrollbar-track {
        background: transparent;
      }

      .segments-list::-webkit-scrollbar-thumb {
        background: ${this.isDarkTheme ? '#3f3f3f' : '#ccc'};
        border-radius: 4px;
      }

      .segments-list::-webkit-scrollbar-thumb:hover {
        background: ${this.isDarkTheme ? '#4f4f4f' : '#aaa'};
      }
    `;
  }

  /**
   * 이벤트 리스너를 설정합니다.
   */
  private setupEventListeners() {
    if (!this.ui.isAttached()) {
      console.log('UI가 아직 첨부되지 않음');
      return;
    }

    // 토글 버튼
    const toggleBtn = this.ui.querySelector('#toggleBtn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleCollapse();
      });
    }

    // 헤더 클릭으로도 토글 가능
    const header = this.ui.querySelector('#panelHeader');
    if (header) {
      header.addEventListener('click', (e) => {
        // 버튼 클릭은 이미 처리되었으므로 제외
        if ((e.target as HTMLElement).closest('#toggleBtn')) return;
        this.toggleCollapse();
      });
    }

    // 루프 생성 버튼
    const createBtn = this.ui.querySelector('#createSegment');
    if (createBtn) {
      createBtn.addEventListener('click', () => this.handleCreateSegment());
    }

    // 세그먼트 라벨 input에서 YouTube 단축키 비활성화
    const segmentLabelInput = this.ui.querySelector<HTMLInputElement>('#segmentLabel');
    if (segmentLabelInput) {
      this.preventYouTubeShortcuts(segmentLabelInput);
    }

    // Tempo 입력
    const tempoInput = this.ui.querySelector<HTMLInputElement>('#tempoInput');
    if (tempoInput) {
      this.preventYouTubeShortcuts(tempoInput);
      tempoInput.addEventListener('focus', (e) => {
        const input = e.target as HTMLInputElement;
        if (input.value === '---') {
          input.value = '';
        }
      });
      tempoInput.addEventListener('blur', (e) => {
        const input = e.target as HTMLInputElement;
        if (input.value.trim() === '') {
          input.value = '---';
        }
      });
      tempoInput.addEventListener('change', (e) => this.handleTempoChange(e as Event));
      tempoInput.addEventListener('mousedown', (e) => this.handleTempoInputMouseDown(e as MouseEvent));
    }

    // Tap Tempo 버튼
    const tapTempoBtn = this.ui.querySelector('#tapTempo');
    if (tapTempoBtn) {
      tapTempoBtn.addEventListener('click', () => this.handleTapTempo());
    }

    // Time Signature 선택
    const timeSignatureSelect = this.ui.querySelector<HTMLSelectElement>('#timeSignature');
    if (timeSignatureSelect) {
      timeSignatureSelect.addEventListener('change', (e) => this.handleTimeSignatureChange(e as Event));
    }

    // Global Sync 입력
    const globalSyncInput = this.ui.querySelector<HTMLInputElement>('#globalSyncInput');
    if (globalSyncInput) {
      this.preventYouTubeShortcuts(globalSyncInput);
      globalSyncInput.addEventListener('change', (e) => this.handleGlobalSyncChange(e as Event));
      globalSyncInput.addEventListener('mousedown', (e) => this.handleGlobalSyncInputMouseDown(e as MouseEvent));
    }

    // Global Sync 버튼
    const syncGlobalBtn = this.ui.querySelector('#syncGlobal');
    if (syncGlobalBtn) {
      syncGlobalBtn.addEventListener('click', () => this.handleSyncGlobal());
    }

    // Global Sync 메트로놈 버튼
    const globalSyncMetronomeBtn = this.ui.querySelector('#globalSyncMetronome');
    if (globalSyncMetronomeBtn) {
      globalSyncMetronomeBtn.addEventListener('click', () => this.handleGlobalSyncMetronomeToggle());
    }

    // 세그먼트 관련 이벤트 (이벤트 위임 사용)
    const segmentsList = this.ui.querySelector('#segmentsList');
    if (segmentsList) {
      segmentsList.addEventListener('click', (e) => this.handleSegmentClick(e as MouseEvent));
      segmentsList.addEventListener('blur', (e) => this.handleInputBlur(e as FocusEvent), true);
      segmentsList.addEventListener('keydown', (e) => this.handleInputKeydown(e as KeyboardEvent), true);
      segmentsList.addEventListener('input', (e) => this.handleInputChange(e as Event), true);
      segmentsList.addEventListener('mousedown', (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('time-input')) {
          this.handleTimeInputMouseDown(e as MouseEvent);
        } else if (target.classList.contains('rate-input')) {
          this.handleRateInputMouseDown(e as MouseEvent);
        }
      }, true);

      // bar-select change 이벤트 처리 (별도 리스너)
      segmentsList.addEventListener('change', (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('bar-select')) {
          this.handleBarSelectChange(e as Event);
        }
      }, true);

      // 모든 time-input, rate-input, bar-input에 YouTube 단축키 비활성화 적용
      const timeInputs = segmentsList.querySelectorAll<HTMLInputElement>('.time-input');
      timeInputs.forEach(input => this.preventYouTubeShortcuts(input));

      const rateInputs = segmentsList.querySelectorAll<HTMLInputElement>('.rate-input');
      rateInputs.forEach(input => this.preventYouTubeShortcuts(input));

      const barSelects = segmentsList.querySelectorAll<HTMLSelectElement>('.bar-select');
      barSelects.forEach(select => this.preventYouTubeShortcuts(select as any));

      // 드래그 앤 드롭 이벤트 (카드 순서 변경)
      segmentsList.addEventListener('dragstart', (e) => this.handleDragStart(e as DragEvent));
      segmentsList.addEventListener('dragover', (e) => this.handleDragOver(e as DragEvent));
      segmentsList.addEventListener('drop', (e) => this.handleDrop(e as DragEvent));
      segmentsList.addEventListener('dragend', (e) => this.handleDragEnd(e as DragEvent));
      segmentsList.addEventListener('dragleave', (e) => this.handleDragLeave(e as DragEvent));
    }
  }

  /**
   * Input 요소에서 YouTube 단축키가 작동하지 않도록 이벤트 전파를 막습니다.
   */
  private preventYouTubeShortcuts(input: HTMLInputElement) {
    input.addEventListener('keydown', (e) => {
      // 이벤트 전파 중단하여 YouTube 단축키 비활성화
      e.stopPropagation();
    });

    input.addEventListener('keyup', (e) => {
      e.stopPropagation();
    });

    input.addEventListener('keypress', (e) => {
      e.stopPropagation();
    });
  }

  /**
   * 패널 펼치기/접기를 토글합니다.
   */
  private toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
    this.render();
    this.setupEventListeners();
  }

  /**
   * 루프 생성 버튼 클릭 처리
   */
  private handleCreateSegment() {
    const labelInput = this.ui.querySelector<HTMLInputElement>('#segmentLabel');
    const durationSelect = this.ui.querySelector<HTMLSelectElement>('#loopDuration');

    const label = labelInput?.value?.trim() || '';
    const durationValue = durationSelect?.value || '10';

    this.onCommand?.('create-segment', { label, duration: durationValue });

    // 입력 필드 초기화
    if (labelInput) {
      labelInput.value = '';
    }
  }

  /**
   * 세그먼트 클릭 이벤트 처리
   */
  private handleSegmentClick(e: MouseEvent) {
    const target = e.target as HTMLElement;

    console.log('handleSegmentClick:', {
      tagName: target.tagName,
      classList: Array.from(target.classList),
      targetElement: target
    });

    // SVG 아이콘 클릭 시 부모 버튼 찾기
    let buttonElement = target;
    if (target.tagName === 'svg' || target.tagName === 'path') {
      const closestButton = target.closest('button');
      if (closestButton) {
        buttonElement = closestButton as HTMLElement;
        console.log('SVG 클릭 감지, 부모 버튼 찾음:', buttonElement);
      }
    }

    if (buttonElement.tagName === 'BUTTON' || buttonElement.tagName === 'INPUT') {
      const segmentId = buttonElement.getAttribute('data-segment-id');
      const action = buttonElement.getAttribute('data-action');

      console.log('세그먼트 클릭 이벤트:', { segmentId, action });

      if (segmentId && action) {
        this.handleAction(action, segmentId);
      } else {
        console.warn('segmentId 또는 action이 없음:', { segmentId, action });
      }
    }
  }

  /**
   * 액션 처리
   */
  private handleAction(action: string, segmentId: string) {
    console.log('handleAction 호출됨:', { action, segmentId });

    switch (action) {
      case 'jump-and-activate':
        console.log('jump-and-activate 액션 실행');
        this.onCommand?.('jump-and-activate', { segmentId });
        break;
      case 'delete':
        console.log('delete 액션 실행');
        this.closeAllMenus();
        this.onCommand?.('delete-segment', { segmentId });
        break;
      case 'toggle-menu':
        console.log('toggle-menu 액션 실행');
        this.toggleMenu(segmentId);
        break;
      case 'edit-label':
        console.log('edit-label 액션 실행');
        this.editSegmentLabel(segmentId);
        break;
      case 'set-start-time':
        console.log('set-start-time 액션 실행');
        this.onCommand?.('set-start-time', { segmentId });
        break;
      case 'set-end-time':
        console.log('set-end-time 액션 실행');
        this.onCommand?.('set-end-time', { segmentId });
        break;
      case 'decrease-rate':
        console.log('decrease-rate 액션 실행');
        this.onCommand?.('decrease-rate', { segmentId });
        break;
      case 'increase-rate':
        console.log('increase-rate 액션 실행');
        this.onCommand?.('increase-rate', { segmentId });
        break;
      case 'toggle-metronome':
        console.log('toggle-metronome 액션 실행');
        this.onCommand?.('toggle-metronome', { segmentId });
        break;
      case 'toggle-collapse':
        console.log('toggle-collapse 액션 실행');
        this.handleToggleCollapse(segmentId);
        break;
      default:
        console.warn('알 수 없는 액션:', action);
    }
  }

  /**
   * 메뉴 토글
   */
  private toggleMenu(segmentId: string) {
    const menu = this.ui.querySelector(`.menu-dropdown[data-segment-id="${segmentId}"]`) as HTMLElement;
    if (!menu) return;

    const isOpen = menu.style.display !== 'none';

    // 모든 메뉴 닫기
    this.closeAllMenus();

    // 현재 메뉴가 닫혀있었다면 열기
    if (!isOpen) {
      menu.style.display = 'block';

      // 외부 클릭 시 메뉴 닫기
      const closeOnOutsideClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.menu-container')) {
          this.closeAllMenus();
          document.removeEventListener('click', closeOnOutsideClick);
        }
      };

      // 약간의 딜레이 후 이벤트 리스너 등록 (현재 클릭 이벤트와 충돌 방지)
      setTimeout(() => {
        document.addEventListener('click', closeOnOutsideClick);
      }, 0);
    }
  }

  /**
   * 모든 메뉴 닫기
   */
  private closeAllMenus() {
    const menus = this.ui.querySelectorAll('.menu-dropdown');
    menus.forEach(menu => {
      (menu as HTMLElement).style.display = 'none';
    });
  }

  /**
   * 라벨 편집
   */
  private editSegmentLabel(segmentId: string) {
    const segmentItem = this.ui.querySelector(`[data-segment-id="${segmentId}"]`);
    if (!segmentItem) return;

    const labelElement = segmentItem.querySelector('.label-text') as HTMLElement;
    if (!labelElement) return;

    const currentLabel = labelElement.textContent || '';

    const inputElement = document.createElement('input');
    inputElement.type = 'text';
    inputElement.className = 'label-input';
    inputElement.value = currentLabel;

    let isSaving = false;

    const saveLabel = () => {
      if (isSaving) return;
      isSaving = true;

      const newLabel = inputElement.value.trim() || 'Loop';
      if (newLabel !== currentLabel) {
        this.onCommand?.('update-label', { segmentId, label: newLabel });
      }

      labelElement.textContent = newLabel;
      if (inputElement.parentNode) {
        inputElement.parentNode.removeChild(inputElement);
      }
      labelElement.style.display = 'inline';
    };

    const cancelEdit = () => {
      if (isSaving) return;
      isSaving = true;

      labelElement.textContent = currentLabel;
      labelElement.style.display = 'inline';

      if (inputElement.parentNode) {
        inputElement.parentNode.removeChild(inputElement);
      }
    };

    inputElement.addEventListener('blur', saveLabel);
    inputElement.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveLabel();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelEdit();
      }
    });

    // YouTube 단축키 비활성화
    this.preventYouTubeShortcuts(inputElement);

    labelElement.style.display = 'none';
    labelElement.parentNode?.insertBefore(inputElement, labelElement);
    inputElement.focus();
    inputElement.select();
  }

  /**
   * Input blur 이벤트 처리
   */
  private handleInputBlur(e: FocusEvent) {
    const target = e.target as HTMLInputElement;

    if (target.classList.contains('time-input')) {
      const segmentId = target.getAttribute('data-segment-id');
      const timeType = target.getAttribute('data-time-type');

      if (segmentId && timeType) {
        const timeValue = this.parseTimeInput(target.value);
        if (timeValue !== null) {
          this.onCommand?.('update-time', { segmentId, timeType, time: timeValue });
        } else {
          // 잘못된 입력은 원래 값으로 복원
          const segment = this.profile?.segments.find(s => s.id === segmentId);
          if (segment) {
            target.value = this.formatTime(timeType === 'start' ? segment.start : segment.end);
          }
        }
      }
    }
  }

  /**
   * Input keydown 이벤트 처리
   */
  private handleInputKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLInputElement;

    if (target.classList.contains('time-input') && e.key === 'Enter') {
      e.preventDefault();
      target.blur();
    }
  }

  /**
   * Input change 이벤트 처리
   */
  private handleInputChange(e: Event) {
    const target = e.target as HTMLInputElement;

    if (target.classList.contains('rate-input')) {
      const segmentId = target.getAttribute('data-segment-id');
      if (segmentId) {
        const newRate = parseFloat(target.value) / 100;
        if (!isNaN(newRate) && newRate >= 0.05 && newRate <= 1.6) {
          this.onCommand?.('update-rate', { segmentId, rate: newRate });
        }
      }
    }
  }

  /**
   * 시간 입력 필드에서 마우스 다운 이벤트 처리 (드래그 시작)
   */
  private handleTimeInputMouseDown(e: MouseEvent) {
    const target = e.target as HTMLInputElement;

    if (!target.classList.contains('time-input')) {
      return;
    }

    // 포커스 상태면 드래그 안 함 (텍스트 편집 중)
    if (document.activeElement === target) {
      return;
    }

    e.preventDefault();

    const segmentId = target.getAttribute('data-segment-id');
    const timeType = target.getAttribute('data-time-type') as 'start' | 'end';

    if (!segmentId || !timeType) return;

    const segment = this.profile?.segments.find(s => s.id === segmentId);
    if (!segment) return;

    const startY = e.clientY;
    const startValue = timeType === 'start' ? segment.start : segment.end;

    target.classList.add('dragging');

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY; // 위로 드래그 = 양수

      // 1픽셀당 0.01초 조정 (Shift 키를 누르면 0.001초로 정밀 조정)
      const sensitivity = moveEvent.shiftKey ? 0.001 : 0.01;
      const delta = deltaY * sensitivity;

      let newValue = Math.max(0, startValue + delta);

      // 소수점 3자리까지만 (ms 단위)
      newValue = Math.round(newValue * 1000) / 1000;

      // Start는 End보다 작아야 하고, End는 Start보다 커야 함
      if (timeType === 'start' && segment.end !== undefined) {
        newValue = Math.min(newValue, segment.end - 0.001);
      } else if (timeType === 'end' && segment.start !== undefined) {
        newValue = Math.max(newValue, segment.start + 0.001);
      }

      // 값 업데이트
      target.value = this.formatTime(newValue);

      // 즉시 반영 (throttle 없이)
      this.onCommand?.('update-time', { segmentId, timeType, time: newValue });
    };

    const onMouseUp = () => {
      target.classList.remove('dragging');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  /**
   * Bar 선택 박스 변경 이벤트 처리
   * 선택된 bar 수를 duration으로 변환하여 End 시간을 변경합니다.
   */
  private handleBarSelectChange(e: Event) {
    const target = e.target as HTMLSelectElement;

    const segmentId = target.getAttribute('data-segment-id');
    if (!segmentId) return;

    const segment = this.profile?.segments.find(s => s.id === segmentId);
    if (!segment || !this.profile?.tempo || !this.profile?.timeSignature) return;

    const bpm = this.profile.tempo;
    const timeSignature = this.profile.timeSignature;
    const barValue = parseInt(target.value, 10);

    if (!isNaN(barValue) && barValue >= 1) {
      // Bar를 duration으로 변환하여 End 시간 계산
      const newDuration = barsToSeconds(barValue, bpm, timeSignature);
      const newEndTime = segment.start + newDuration;

      // 즉시 반영
      this.onCommand?.('update-time', { segmentId, timeType: 'end', time: newEndTime });
    }
  }

  /**
   * 속도 입력 필드에서 마우스 다운 이벤트 처리 (드래그 시작)
   */
  private handleRateInputMouseDown(e: MouseEvent) {
    const target = e.target as HTMLInputElement;

    if (!target.classList.contains('rate-input')) {
      return;
    }

    // 포커스 상태면 드래그 안 함
    if (document.activeElement === target) {
      return;
    }

    e.preventDefault();

    const segmentId = target.getAttribute('data-segment-id');

    if (!segmentId) return;

    const segment = this.profile?.segments.find(s => s.id === segmentId);
    if (!segment) return;

    const startY = e.clientY;
    const startRate = segment.rate || 1.0;

    target.classList.add('dragging');

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY; // 위로 드래그 = 양수

      // 1픽셀당 0.01 (1%) 조정
      const delta = deltaY * 0.01;

      let newRate = startRate + delta;

      // 5% ~ 160% 범위로 제한
      newRate = Math.max(0.05, Math.min(1.6, newRate));

      // 소수점 2자리까지만
      newRate = Math.round(newRate * 100) / 100;

      // 값 업데이트 (% 단위로 표시)
      const ratePercent = Math.round(newRate * 100);
      target.value = ratePercent.toString();

      // 즉시 반영
      this.onCommand?.('update-rate', { segmentId, rate: newRate });
    };

    const onMouseUp = () => {
      target.classList.remove('dragging');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  /**
   * 시간 형식을 파싱합니다. (ms 단위 지원)
   */
  private parseTimeInput(timeString: string): number | null {
    const trimmed = timeString.trim();

    if (!trimmed) return null;

    // m:ss.mmm 형식
    const parts = trimmed.split(':');
    if (parts.length === 2) {
      const minutes = parseInt(parts[0], 10);
      const secondsPart = parts[1].split('.');
      const seconds = parseInt(secondsPart[0], 10);
      const milliseconds = secondsPart[1] ? parseInt(secondsPart[1].padEnd(3, '0').substring(0, 3), 10) : 0;

      if (!isNaN(minutes) && !isNaN(seconds) && minutes >= 0 && seconds >= 0 && seconds < 60) {
        return minutes * 60 + seconds + milliseconds / 1000;
      }
      return null;
    }

    // ss.mmm 형식
    const totalSeconds = parseFloat(trimmed);
    if (!isNaN(totalSeconds) && totalSeconds >= 0) {
      return totalSeconds;
    }

    return null;
  }

  /**
   * 시간을 포맷합니다. (ms 단위까지 표시)
   */
  private formatTime(seconds: number): string {
    if (typeof seconds !== 'number' || isNaN(seconds)) {
      return '0:00.000';
    }

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }

  /**
   * Tempo 값 변경 처리
   */
  private handleTempoChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const value = input.value.trim();

    // "---"이거나 빈 값이면 tempo를 undefined로 설정
    if (value === '---' || value === '') {
      input.value = '---';
      this.onCommand?.('update-tempo', { tempo: undefined });
      return;
    }

    let tempo = parseInt(value, 10);

    // 유효성 검사
    if (isNaN(tempo) || tempo < 20) {
      tempo = 20;
    } else if (tempo > 300) {
      tempo = 300;
    }

    input.value = tempo.toString();
    this.onCommand?.('update-tempo', { tempo });
  }

  /**
   * Tempo 입력 필드에서 마우스 다운 이벤트 처리 (드래그 시작)
   */
  private handleTempoInputMouseDown(e: MouseEvent) {
    const target = e.target as HTMLInputElement;

    // 포커스 상태면 드래그 안 함
    if (document.activeElement === target) {
      return;
    }

    e.preventDefault();

    const startY = e.clientY;
    const currentValue = target.value.trim();
    const startValue = (currentValue === '---' || currentValue === '') ? 120 : parseInt(currentValue, 10);

    target.classList.add('dragging');

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY;
      // 5픽셀당 1 BPM 변경
      const delta = Math.round(deltaY / 5);

      let newValue = startValue + delta;

      // BPM 범위 제한 (20-300)
      newValue = Math.max(20, Math.min(300, newValue));

      // 값 업데이트
      target.value = newValue.toString();

      // 즉시 반영
      this.onCommand?.('update-tempo', { tempo: newValue });
    };

    const onMouseUp = () => {
      target.classList.remove('dragging');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  /**
   * Tap Tempo 버튼 클릭 처리
   */
  private tapTimes: number[] = [];
  private handleTapTempo() {
    const now = Date.now();

    // 마지막 탭으로부터 2초 이상 지났으면 리셋
    if (this.tapTimes.length > 0 && now - this.tapTimes[this.tapTimes.length - 1] > 2000) {
      this.tapTimes = [];
    }

    this.tapTimes.push(now);

    // 최소 2번의 탭이 필요
    if (this.tapTimes.length < 2) {
      return;
    }

    // 최근 8번의 탭만 사용
    if (this.tapTimes.length > 8) {
      this.tapTimes.shift();
    }

    // 평균 간격 계산
    const intervals: number[] = [];
    for (let i = 1; i < this.tapTimes.length; i++) {
      intervals.push(this.tapTimes[i] - this.tapTimes[i - 1]);
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const bpm = Math.round(60000 / avgInterval);

    // BPM 범위 제한
    const clampedBpm = Math.max(20, Math.min(300, bpm));

    // UI 업데이트
    const tempoInput = this.ui.querySelector<HTMLInputElement>('#tempoInput');
    if (tempoInput) {
      tempoInput.value = clampedBpm.toString();
    }

    this.onCommand?.('update-tempo', { tempo: clampedBpm });
  }

  /**
   * Time Signature 변경 처리
   */
  private handleTimeSignatureChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    const timeSignature = select.value === '' ? undefined : select.value;
    this.onCommand?.('update-time-signature', { timeSignature });
  }

  /**
   * 세그먼트 펼치기/접기 토글
   */
  private handleToggleCollapse(segmentId: string) {
    const currentState = this.collapsedSegments.get(segmentId) || false;
    this.collapsedSegments.set(segmentId, !currentState);

    // localStorage에 저장
    this.saveCollapsedState();

    // UI 갱신
    this.render();
    this.setupEventListeners();

    // 마지막 카드가 잘리지 않도록 스크롤 조정
    setTimeout(() => {
      const segmentsList = this.ui.querySelector('.segments-list');
      const toggledCard = this.ui.querySelector(`[data-segment-id="${segmentId}"]`);

      if (segmentsList && toggledCard) {
        const listRect = segmentsList.getBoundingClientRect();
        const cardRect = toggledCard.getBoundingClientRect();

        // 카드 하단이 리스트 영역 밖에 있는 경우
        if (cardRect.bottom > listRect.bottom) {
          const scrollAmount = cardRect.bottom - listRect.bottom + 10; // 10px 여유
          segmentsList.scrollTop += scrollAmount;
        }
      }
    }, 50); // DOM 업데이트 후 실행
  }

  /**
   * 접힌 상태를 localStorage에 저장
   */
  private saveCollapsedState() {
    const stateObj: { [key: string]: boolean } = {};
    this.collapsedSegments.forEach((value, key) => {
      stateObj[key] = value;
    });
    localStorage.setItem('loop-practice-collapsed-segments', JSON.stringify(stateObj));
  }

  /**
   * 접힌 상태를 localStorage에서 로드
   */
  private loadCollapsedState() {
    try {
      const saved = localStorage.getItem('loop-practice-collapsed-segments');
      if (saved) {
        const stateObj = JSON.parse(saved);
        Object.entries(stateObj).forEach(([key, value]) => {
          this.collapsedSegments.set(key, value as boolean);
        });
      }
    } catch (error) {
      console.error('Failed to load collapsed state:', error);
    }
  }

  /**
   * 드래그 시작 핸들러
   */
  private handleDragStart(e: DragEvent) {
    const target = e.target as HTMLElement;
    const segmentItem = target.closest('.segment-item') as HTMLElement;

    if (!segmentItem) return;

    // 버튼, 입력 필드 등을 드래그할 때는 카드 드래그 방지
    if (target.tagName === 'BUTTON' ||
        target.tagName === 'INPUT' ||
        target.tagName === 'SELECT' ||
        target.closest('button') ||
        target.closest('input') ||
        target.closest('select')) {
      e.preventDefault();
      return;
    }

    this.draggedSegmentId = segmentItem.dataset.segmentId || null;
    segmentItem.classList.add('dragging');

    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/html', segmentItem.innerHTML);
    }
  }

  /**
   * 드래그 오버 핸들러
   */
  private handleDragOver(e: DragEvent) {
    e.preventDefault();

    const target = e.target as HTMLElement;
    const segmentItem = target.closest('.segment-item') as HTMLElement;

    if (!segmentItem || !this.draggedSegmentId) return;

    const targetId = segmentItem.dataset.segmentId;
    if (targetId === this.draggedSegmentId) return;

    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }

    // 드래그 오버 시각 효과
    segmentItem.classList.add('drag-over');
  }

  /**
   * 드래그 리브 핸들러
   */
  private handleDragLeave(e: DragEvent) {
    const target = e.target as HTMLElement;
    const segmentItem = target.closest('.segment-item') as HTMLElement;

    if (segmentItem) {
      segmentItem.classList.remove('drag-over');
    }
  }

  /**
   * 드롭 핸들러
   */
  private handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();

    const target = e.target as HTMLElement;
    const targetItem = target.closest('.segment-item') as HTMLElement;

    if (!targetItem || !this.draggedSegmentId || !this.profile) return;

    const targetId = targetItem.dataset.segmentId;
    if (!targetId || targetId === this.draggedSegmentId) return;

    // 세그먼트 배열에서 인덱스 찾기
    const draggedIndex = this.profile.segments.findIndex(s => s.id === this.draggedSegmentId);
    const targetIndex = this.profile.segments.findIndex(s => s.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    // 배열 순서 변경
    const [draggedSegment] = this.profile.segments.splice(draggedIndex, 1);
    this.profile.segments.splice(targetIndex, 0, draggedSegment);

    // UI 업데이트 및 저장
    this.onCommand?.('reorder-segments', { segments: this.profile.segments });

    targetItem.classList.remove('drag-over');
  }

  /**
   * 드래그 종료 핸들러
   */
  private handleDragEnd(e: DragEvent) {
    const target = e.target as HTMLElement;
    const segmentItem = target.closest('.segment-item') as HTMLElement;

    if (segmentItem) {
      segmentItem.classList.remove('dragging');
    }

    // 모든 drag-over 클래스 제거
    const allItems = this.ui.querySelectorAll('.segment-item');
    allItems.forEach(item => item.classList.remove('drag-over'));

    this.draggedSegmentId = null;
  }

  /**
   * Global Sync 입력 변경 핸들러
   */
  private handleGlobalSyncChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const value = parseFloat(input.value);

    if (isNaN(value)) {
      input.value = this.formatSyncOffset(this.profile?.globalMetronomeOffset || 0);
      return;
    }

    // -999.999 ~ 999.999 범위로 제한
    const clampedValue = Math.max(-999.999, Math.min(999.999, value));
    input.value = this.formatSyncOffset(clampedValue);

    this.onCommand?.('update-global-sync', { offset: clampedValue });
  }

  /**
   * Global Sync 입력 마우스다운 핸들러 (드래그로 값 조정)
   */
  private handleGlobalSyncInputMouseDown(e: MouseEvent) {
    const input = e.target as HTMLInputElement;
    const startY = e.clientY;
    const startValue = parseFloat(input.value) || 0;

    let isDragging = false;
    const dragThreshold = 3;
    let lastValue = startValue;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY;

      if (!isDragging && Math.abs(deltaY) < dragThreshold) {
        return;
      }

      isDragging = true;
      input.style.cursor = 'ns-resize';

      // 1px = 0.001s
      const newValue = startValue + (deltaY * 0.001);
      const clampedValue = Math.max(-999.999, Math.min(999.999, newValue));

      input.value = this.formatSyncOffset(clampedValue);
      lastValue = clampedValue;

      // 실시간 업데이트 (저장하지 않고 메트로놈만 업데이트)
      this.onCommand?.('update-global-sync-realtime', { offset: clampedValue });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      input.style.cursor = 'ns-resize';

      if (isDragging) {
        e.preventDefault();
        // 드래그 종료 시 최종 값 저장
        this.onCommand?.('update-global-sync', { offset: lastValue });
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }

  /**
   * Global Sync 버튼 클릭 핸들러 (모든 루프에 싱크 적용)
   */
  private handleSyncGlobal() {
    if (!this.profile?.tempo || !this.profile?.timeSignature) {
      return;
    }

    const offset = this.profile.globalMetronomeOffset || 0;

    // 확인 다이얼로그
    const hasSegments = this.profile.segments.length > 0;
    const message = hasSegments
      ? `Apply global sync (${this.formatSyncOffset(offset)}s) to all loops?\n\nThis will overwrite existing loop-specific sync settings.`
      : `Save global sync setting (${this.formatSyncOffset(offset)}s)?`;

    if (!confirm(message)) {
      return;
    }

    // 모든 루프에 글로벌 싱크 적용
    this.onCommand?.('apply-global-sync', { offset });
  }

  /**
   * Global Sync 메트로놈 토글 핸들러
   */
  private handleGlobalSyncMetronomeToggle() {
    if (!this.profile?.tempo || !this.profile?.timeSignature) {
      return;
    }

    // 상태 토글
    this.globalSyncMetronomeEnabled = !this.globalSyncMetronomeEnabled;

    // 커맨드 전송
    this.onCommand?.('toggle-global-sync-metronome', {
      enabled: this.globalSyncMetronomeEnabled
    });

    // UI 업데이트
    this.render();
    this.setupEventListeners();
  }

  /**
   * UI를 정리합니다.
   */
  cleanup() {
    this.ui.remove();
  }
}
