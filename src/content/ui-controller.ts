// Content Script UI 컨트롤러
import { VideoProfile, LoopSegment } from '../types';
import { YouTubeUI } from './ui';
import { barsToSeconds, secondsToBars } from '../utils';
import { Metronome } from './audio/metronome';

export class UIController {
  private ui: YouTubeUI;
  private profile?: VideoProfile;
  private onCommand?: (command: string, data?: any) => void;
  private isCollapsed: boolean = false;
  private isDarkTheme: boolean = false;
  private collapsedSegments: Map<string, boolean> = new Map(); // 세그먼트별 접힌 상태 저장
  private draggedSegmentId: string | null = null; // 드래그 중인 세그먼트 ID
  private lastClickTime: Map<string, number> = new Map(); // 더블클릭 감지용 마지막 클릭 시간
  private openBarsDropdownId: string | null = null; // 현재 열린 bars 드롭다운 ID

  // Tap Sync 관련 상태
  private tapSyncCurrentBeat: number = 0; // 현재 박자 (1, 2, 3, 4... 0이면 초기 상태)
  private tapSyncMetronome: Metronome = new Metronome(); // TAP 피드백용 메트로놈
  private isGlobalMetronomeEnabled: boolean = false; // 글로벌 메트로놈 활성화 상태
  private metronomeVolume: number = 80; // 메트로놈 볼륨 (0-100)

  // TAP Sync 정밀도 향상을 위한 탭 기록
  // { beatNumber: 1-4, tappedTime: video.currentTime, calculatedOffset: 첫박 기준 오프셋 }
  private tapSyncHistory: Array<{ beatNumber: number; tappedTime: number; calculatedOffset: number }> = [];
  private tapSyncScore: number = 0; // 0-100 점수
  private tapSyncLastResetTime: number = 0; // 마지막 리셋 시간

  // 점수를 표시하기 위한 최소 탭 수 (표본이 적으면 점수 신뢰도가 낮음)
  private readonly TAP_SYNC_MIN_SAMPLES = 6;

  // Beat Sync 모달 관련 상태
  private localTapSyncCurrentBeat: number = 0; // 로컬 TAP Sync 현재 박자
  private localTapSyncHistory: Array<{ beatNumber: number; tappedTime: number; calculatedOffset: number }> = [];
  private localTapSyncScore: number = 0;
  private localTapSyncLastResetTime: number = 0;

  // 토스트 메시지 타이머
  private toastTimer: number | null = null;

  constructor() {
    this.ui = new YouTubeUI();
    this.detectTheme();
    this.observeThemeChanges();
  }

  /**
   * 토스트 메시지를 표시합니다.
   * @param message 메시지 내용
   * @param type 메시지 유형 ('success' | 'error' | 'info')
   * @param duration 표시 시간 (ms), 기본 2000ms
   */
  showToast(message: string, type: 'success' | 'error' | 'info' = 'info', duration: number = 2000): void {
    // 기존 토스트 제거
    const existingToast = this.ui.querySelector('.loop-practice-toast');
    if (existingToast) {
      existingToast.remove();
    }
    if (this.toastTimer !== null) {
      clearTimeout(this.toastTimer);
    }

    // 토스트 생성
    const toast = document.createElement('div');
    toast.className = `loop-practice-toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      padding: 10px 20px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      z-index: 10002;
      animation: toastFadeIn 0.2s ease;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      ${type === 'success' ? 'background: #4caf50; color: white;' : ''}
      ${type === 'error' ? 'background: #f44336; color: white;' : ''}
      ${type === 'info' ? `background: ${this.isDarkTheme ? '#424242' : '#333'}; color: white;` : ''}
    `;

    // 애니메이션 스타일 추가 (없으면)
    if (!document.getElementById('loop-practice-toast-style')) {
      const style = document.createElement('style');
      style.id = 'loop-practice-toast-style';
      style.textContent = `
        @keyframes toastFadeIn {
          from { opacity: 0; transform: translateX(-50%) translateY(10px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes toastFadeOut {
          from { opacity: 1; transform: translateX(-50%) translateY(0); }
          to { opacity: 0; transform: translateX(-50%) translateY(-10px); }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(toast);

    // 일정 시간 후 제거
    this.toastTimer = window.setTimeout(() => {
      toast.style.animation = 'toastFadeOut 0.2s ease forwards';
      setTimeout(() => toast.remove(), 200);
      this.toastTimer = null;
    }, duration);
  }

  /**
   * 세그먼트의 Beat Sync가 완료되었는지 확인합니다.
   * BPM, 박자표, 오프셋(TAP Sync)이 모두 설정되어 있어야 true를 반환합니다.
   */
  private isBeatSyncComplete(segment: LoopSegment): boolean {
    // 로컬 설정 사용 시
    if (segment.useGlobalSync === false) {
      const hasLocalTempo = typeof segment.localTempo === 'number' && segment.localTempo > 0;
      const hasLocalTimeSignature = typeof segment.localTimeSignature === 'string' && segment.localTimeSignature.length > 0;
      const hasLocalOffset = typeof segment.localMetronomeOffset === 'number';
      return hasLocalTempo && hasLocalTimeSignature && hasLocalOffset;
    }

    // 글로벌 설정 사용 시
    if (!this.profile) return false;
    const hasGlobalTempo = typeof this.profile.tempo === 'number' && this.profile.tempo > 0;
    const hasGlobalTimeSignature = typeof this.profile.timeSignature === 'string' && this.profile.timeSignature.length > 0;
    const hasGlobalOffset = typeof this.profile.globalMetronomeOffset === 'number';
    return hasGlobalTempo && hasGlobalTimeSignature && hasGlobalOffset;
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
   * 세그먼트가 유효한 Beat Sync 설정을 가지고 있는지 확인합니다.
   * (글로벌 또는 로컬 설정이 있으면 true)
   */
  private hasEffectiveSync(segment: LoopSegment): boolean {
    if (segment.useGlobalSync !== false) {
      // 글로벌 설정 사용
      return !!(this.profile?.tempo && this.profile?.timeSignature);
    } else {
      // 로컬 설정 사용
      return !!(segment.localTempo && segment.localTimeSignature);
    }
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
    const roundedBars = Math.max(1, Math.min(32, Math.round(bars))); // 1-32 범위로 제한

    // 커스텀 드롭다운 사용
    return this.getCustomBarsDropdownHTML(`bar-select-${segmentId}`, roundedBars, 'bar-select', segmentId);
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

        <!-- Beat Navigation & Metronome Control -->
        ${this.getBeatNavigationHTML()}

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
                  <label>Tempo (BPM)</label>
                  <div class="tempo-controls">
                    <input type="text" id="tempoInput" class="tempo-input" value="${tempo || '---'}" data-placeholder="---">
                    <button class="btn btn-small btn-tap" id="tapTempo">TAP</button>
                  </div>
                </div>

                <div class="setting-group">
                  <label>Time Signature</label>
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

              <!-- Tap Sync -->
              ${this.getTapSyncHTML(tempo, timeSignature)}
            </div>
          </div>

          <!-- Loop Management (Compact) -->
          <div class="loop-create-bar">
            <div class="label-input-wrapper">
              <input
                type="text"
                id="segmentLabel"
                class="segment-input label-input"
                placeholder="Loop name..."
                autocomplete="off"
              />
              <button type="button" class="label-dropdown-toggle" id="labelDropdownToggle">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M7 10l5 5 5-5z"/>
                </svg>
              </button>
              <div class="label-dropdown" id="labelDropdown" style="display: none;">
                <div class="label-option" data-value="Intro">Intro</div>
                <div class="label-option" data-value="Verse">Verse</div>
                <div class="label-option" data-value="Pre Chorus">Pre Chorus</div>
                <div class="label-option" data-value="Chorus">Chorus</div>
                <div class="label-option" data-value="Interlude">Interlude</div>
                <div class="label-option" data-value="Bridge">Bridge</div>
                <div class="label-option" data-value="Outro">Outro</div>
              </div>
            </div>
            ${this.getCustomBarsDropdownHTML('loopDuration', 'bar:8', 'duration')}
            <button class="btn btn-small btn-primary" id="createSegment">+</button>
          </div>

          ${this.profile?.globalMetronomeOffset !== undefined ? `
            <div class="quantize-section">
              <span class="setting-description">Snap loop start/end points to the nearest beat.</span>
              <button class="btn btn-small btn-quantize-all" id="quantizeAllBtn">Quantize All</button>
            </div>
          ` : ''}

          <div class="segments-list" id="segmentsList">
            ${segmentsHTML || '<div class="no-loops">No loops yet. Create one!</div>'}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Tap Sync UI HTML을 생성합니다.
   */
  private getTapSyncHTML(tempo: number | undefined, timeSignature: string | undefined): string {
    const isEnabled = tempo && timeSignature;
    const beatsPerBar = timeSignature ? parseInt(timeSignature.split('/')[0], 10) : 4;
    const firstBeatTime = this.profile?.globalMetronomeOffset;
    const hasFirstBeat = typeof firstBeatTime === 'number';

    // 현재 박자 표시 (1, 2, 3, 4 중 하나)
    const currentBeatDisplay = this.tapSyncCurrentBeat > 0
      ? `${this.tapSyncCurrentBeat}/${beatsPerBar}`
      : 'TAP';

    // 점수에 따른 색상 (신호등 색깔)
    const tapCount = this.tapSyncHistory.length;
    const hasEnoughSamples = tapCount >= this.TAP_SYNC_MIN_SAMPLES;
    const scoreColor = hasEnoughSamples ? this.getScoreColor(this.tapSyncScore) : '#888';
    const scoreText = hasEnoughSamples ? `${this.tapSyncScore}%` : '--%';
    const scoreBgColor = hasEnoughSamples ? this.getScoreBgColor(this.tapSyncScore) : (this.isDarkTheme ? '#2a2a2a' : '#f0f0f0');

    return `
      <div class="setting-group tap-sync-group" ${!isEnabled ? 'style="display: none;"' : ''}>
        <label>Beat Sync <span class="sync-hint">(wired headphones recommended)</span></label>
        <div class="setting-description">Sync beat timing with the video to find the first downbeat offset.</div>
        <div class="tap-sync-controls">
          <div class="tap-sync-row">
            <button
              class="btn btn-tap-sync ${this.tapSyncCurrentBeat > 0 ? 'tapped' : ''}"
              id="tapSyncBtn"
              title="Tap along with the beat. Each tap refines the sync accuracy."
            >
              ${currentBeatDisplay}
            </button>
            <div class="sync-result-box ${hasFirstBeat ? 'has-result' : ''}" style="background: ${scoreBgColor}; border-color: ${hasFirstBeat ? scoreColor : 'transparent'};" title="${hasFirstBeat ? `Accuracy: ${scoreText} (${tapCount} taps)` : 'Tap to sync'}">
              <div class="sync-score" style="color: ${scoreColor};">
                <span class="score-label">Sync:</span>
                <span class="score-value">${scoreText}</span>
              </div>
              ${hasFirstBeat ? `
                <div class="sync-time">
                  <span class="time-value" id="syncOffsetDisplay" title="Double-click to edit">${this.formatSyncTime(firstBeatTime)}</span>
                  <input type="text" class="sync-offset-input" id="syncOffsetInput" style="display: none;" />
                  <button class="btn-sync-clear-inline" id="syncClear" title="Clear sync">✕</button>
                </div>
              ` : `
                <div class="sync-time placeholder">
                  <span class="time-value">--:---.---</span>
                </div>
              `}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 점수에 따른 배경색 반환
   */
  private getScoreBgColor(score: number): string {
    if (score >= 80) return this.isDarkTheme ? '#1a3a1a' : '#e8f5e9'; // 초록 배경
    if (score >= 50) return this.isDarkTheme ? '#3a3020' : '#fff3e0'; // 주황 배경
    return this.isDarkTheme ? '#3a1a1a' : '#ffebee'; // 빨강 배경
  }

  /**
   * 점수에 따른 색상 반환 (신호등 색깔)
   */
  private getScoreColor(score: number): string {
    if (score >= 80) return '#4caf50'; // 초록 (좋음)
    if (score >= 50) return '#ff9800'; // 주황 (보통)
    return '#f44336'; // 빨강 (나쁨)
  }

  /**
   * 싱크 시간을 포맷팅합니다 (m:ss.xxx 형식).
   */
  private formatSyncTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toFixed(3).padStart(6, '0')}`;
  }

  /**
   * 박자표에서 마디당 박수를 추출합니다.
   */
  private getBeatsPerBar(timeSignature: string): number {
    return parseInt(timeSignature.split('/')[0], 10) || 4;
  }

  /**
   * Beat Navigation + Metronome Control HTML을 생성합니다.
   * 비트 네비게이션은 항상 표시되고, 그 아래에 메트로놈 컨트롤이 콤팩트하게 배치됩니다.
   */
  private getBeatNavigationHTML(): string {
    const hasFirstBeat = typeof this.profile?.globalMetronomeOffset === 'number';
    const beatsPerBar = this.profile?.timeSignature
      ? parseInt(this.profile.timeSignature.split('/')[0], 10)
      : 4;

    // 박자 수에 맞는 비트 표시 생성
    const beatSpans = Array.from({ length: beatsPerBar }, (_, i) =>
      `<span class="count-beat" data-beat="${i + 1}">${i + 1}</span>`
    ).join('');

    return `
      <div class="beat-nav-section ${hasFirstBeat ? 'has-sync' : ''}">
        <div class="count-in-display" id="countInDisplay">
          ${beatSpans}
        </div>
        <div class="metronome-control-row ${!hasFirstBeat ? 'disabled' : ''}">
          <button
            class="btn btn-metronome-compact ${this.isGlobalMetronomeEnabled ? 'active' : ''}"
            id="globalMetronomeToggle"
            title="${hasFirstBeat ? 'Toggle metronome' : 'Beat Sync required'}"
            ${!hasFirstBeat ? 'disabled' : ''}
          >
            <span class="metronome-icon">♪</span>
            <span class="metronome-status">${this.isGlobalMetronomeEnabled ? 'ON' : 'OFF'}</span>
          </button>
          <div class="volume-control-compact">
            <span class="volume-icon-small">🔊</span>
            <input
              type="range"
              id="metronomeVolume"
              class="volume-slider-compact"
              min="0"
              max="100"
              value="${this.metronomeVolume}"
              title="${hasFirstBeat ? `Volume: ${this.metronomeVolume}%` : 'Beat Sync required'}"
              ${!hasFirstBeat ? 'disabled' : ''}
            />
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

    // 커스텀 비트싱크 사용 여부 (useGlobalSync === false이고 로컬 설정이 있는 경우)
    const hasCustomSync = segment.useGlobalSync === false &&
      typeof segment.localMetronomeOffset === 'number';

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
          <div class="segment-time-range">
            <span>${this.formatTime(safeStart)}</span>
            <span>~ ${this.formatTime(safeEnd)}</span>
          </div>
          <div class="loop-btn-container">
            <button class="btn btn-loop-compact ${isActive ? 'active' : ''}" data-segment-id="${segment.id}" data-action="jump-and-activate" title="Activate loop">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
              </svg>
            </button>
            ${hasCustomSync ? '<span class="custom-sync-badge" title="Custom Beat Sync">C</span>' : ''}
          </div>
          ` : ''}
          <div class="menu-container">
            <button class="btn-menu" data-segment-id="${segment.id}" data-action="toggle-menu" title="More options">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
              </svg>
            </button>
            <div class="menu-dropdown" data-segment-id="${segment.id}" style="display: none;">
              <button class="menu-item" data-segment-id="${segment.id}" data-action="duplicate">Duplicate</button>
              <button class="menu-item" data-segment-id="${segment.id}" data-action="open-beat-sync">Beat Sync</button>
              ${this.isBeatSyncComplete(segment) ? `<button class="menu-item" data-segment-id="${segment.id}" data-action="quantize">Quantize</button>` : ''}
              <button class="menu-item menu-delete" data-segment-id="${segment.id}" data-action="delete">Delete</button>
            </div>
          </div>
        </div>
        <div class="segment-body" style="${isCollapsed ? 'display: none;' : ''}">
          <div class="segment-controls">
            <div class="time-input-group">
              <label>Start:</label>
              <input type="text" class="time-input" data-segment-id="${segment.id}" data-time-type="start"
                     value="${this.formatTime(safeStart)}" placeholder="00:00.000">
              <button class="time-set-btn" data-segment-id="${segment.id}" data-action="set-start-time" title="Set to current time">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                </svg>
              </button>
            </div>
            <div class="time-input-group">
              <label>End:</label>
              <input type="text" class="time-input" data-segment-id="${segment.id}" data-time-type="end"
                     value="${this.formatTime(safeEnd)}" placeholder="00:00.000">
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
              <div class="loop-btn-container">
                <button class="btn btn-loop ${isActive ? 'active' : ''}" data-segment-id="${segment.id}" data-action="jump-and-activate" title="Activate loop">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                  </svg>
                </button>
                ${hasCustomSync ? '<span class="custom-sync-badge" title="Custom Beat Sync">C</span>' : ''}
              </div>
              <!-- 카운트인 버튼 임시 숨김 (로직은 유지) -->
              <!--
              <button class="btn btn-count-in ${segment.countInEnabled ? 'active' : ''}" data-segment-id="${segment.id}" data-action="toggle-count-in" title="Count-in (1 bar before loop)"
                      ${!this.hasEffectiveSync(segment) ? 'disabled' : ''}>
                <span class="count-in-label">1234</span>
              </button>
              -->
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
        ${this.getAdd8BarsButtonHTML(segment.id, isCollapsed)}
      </div>
    `;
  }

  /**
   * Add 8 bars 버튼 HTML을 생성합니다.
   * 카드가 접혀있는 경우 버튼을 숨기고, BPM/박자표가 설정되지 않은 경우 안내 메시지를 표시합니다.
   */
  private getAdd8BarsButtonHTML(segmentId: string, isCollapsed: boolean): string {
    if (isCollapsed) {
      return '';
    }

    if (!this.profile?.tempo || !this.profile?.timeSignature) {
      return `
        <div class="btn-add-8-bars disabled" title="Set BPM and time signature to enable bar mode">
          <span>Set tempo for bar mode</span>
        </div>
      `;
    }

    return `
      <button class="btn-add-8-bars" data-segment-id="${segmentId}" data-action="add-8-bars" title="Create 8 bars loop after this">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
        <span>Create 8 bars loop</span>
      </button>
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

      /* Tap Sync 스타일 */
      .tap-sync-group {
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid ${borderColor};
      }

      .sync-hint {
        font-size: 10px;
        font-weight: 400;
        color: ${textSecondary};
        opacity: 0.8;
      }

      .setting-description {
        font-size: 11px;
        color: ${textSecondary};
        margin-top: 2px;
        margin-bottom: 8px;
        opacity: 0.8;
      }

      .quantize-section {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        margin-bottom: 8px;
        background: ${this.isDarkTheme ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'};
        border-radius: 4px;
      }

      .quantize-section .setting-description {
        margin: 0;
        flex: 1;
      }

      .btn-quantize-all {
        font-size: 11px;
        padding: 4px 8px;
        margin-left: 8px;
        white-space: nowrap;
        background: ${this.isDarkTheme ? '#3f3f3f' : '#f0f0f0'};
        border: 1px solid ${this.isDarkTheme ? '#5a5a5a' : '#ccc'};
        color: ${this.isDarkTheme ? '#fff' : '#333'};
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .btn-quantize-all:hover {
        background: ${this.isDarkTheme ? '#4a7fc7' : '#4a7fc7'};
        border-color: ${this.isDarkTheme ? '#5a9fd7' : '#5a9fd7'};
        color: white;
      }

      .btn-quantize-all:active {
        background: ${this.isDarkTheme ? '#3a6fb7' : '#3a6fb7'};
      }

      .tap-sync-controls {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .tap-sync-row {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .btn-tap-sync {
        flex: 0 0 auto;
        min-width: 80px;
        padding: 8px 12px;
        background: ${this.isDarkTheme ? '#3f3f3f' : '#e0e0e0'};
        color: ${textPrimary};
        border: 1px solid ${inputBorder};
        border-radius: 4px;
        font-size: 13px;
        font-weight: 600;
        font-family: 'Roboto Mono', monospace;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .btn-tap-sync:hover {
        background: ${this.isDarkTheme ? '#505050' : '#d0d0d0'};
      }

      .btn-tap-sync:active {
        background: #065fd4;
        color: white;
        transform: scale(0.98);
      }

      .btn-tap-sync.tapped {
        background: ${this.isDarkTheme ? '#1a3a1a' : '#e8f5e9'};
        border-color: #4caf50;
        color: ${this.isDarkTheme ? '#81c784' : '#2e7d32'};
      }

      .tap-sync-hint {
        font-size: 11px;
        color: ${textSecondary};
        opacity: 0.8;
      }

      /* Sync Result Box (compact single-line) */
      .sync-result-box {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 10px;
        border-radius: 4px;
        border: 1px solid transparent;
        transition: all 0.15s ease;
      }

      .sync-result-box.has-result {
        border-width: 1px;
        border-style: solid;
      }

      .sync-score {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
      }

      .sync-score .score-label {
        font-weight: 400;
        opacity: 0.8;
      }

      .sync-score .score-value {
        font-weight: 600;
        font-family: 'Roboto Mono', monospace;
      }

      .sync-time {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .sync-time .time-value {
        font-size: 12px;
        font-weight: 500;
        font-family: 'Roboto Mono', monospace;
        color: ${textPrimary};
        cursor: pointer;
      }

      .sync-time .time-value:hover {
        text-decoration: underline;
        text-decoration-style: dotted;
      }

      .sync-time .sync-offset-input {
        width: 80px;
        font-size: 12px;
        font-weight: 500;
        font-family: 'Roboto Mono', monospace;
        color: ${textPrimary};
        background: ${this.isDarkTheme ? '#1a1a1a' : '#ffffff'};
        border: 1px solid ${this.isDarkTheme ? '#444' : '#ccc'};
        border-radius: 4px;
        padding: 2px 6px;
        outline: none;
      }

      .sync-time .sync-offset-input:focus {
        border-color: #ff0000;
        box-shadow: 0 0 0 2px rgba(255, 0, 0, 0.2);
      }

      .sync-time.placeholder .time-value {
        color: ${textSecondary};
        opacity: 0.5;
        cursor: default;
      }

      .sync-time.placeholder .time-value:hover {
        text-decoration: none;
      }

      .btn-sync-clear-inline {
        padding: 2px 6px;
        background: transparent;
        color: ${textSecondary};
        border: none;
        border-radius: 3px;
        font-size: 11px;
        cursor: pointer;
        opacity: 0.6;
        transition: all 0.15s ease;
      }

      .btn-sync-clear-inline:hover {
        background: ${this.isDarkTheme ? 'rgba(244, 67, 54, 0.2)' : 'rgba(244, 67, 54, 0.1)'};
        color: #f44336;
        opacity: 1;
      }

      /* Beat Navigation Section */
      .beat-nav-section {
        padding: 8px 16px;
        background: ${this.isDarkTheme ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)'};
        border-bottom: 1px solid ${borderColor};
      }

      .beat-nav-section:not(.has-sync) .count-in-display {
        opacity: 0.4;
      }

      /* Metronome Control Row (compact) */
      .metronome-control-row {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin-top: 6px;
      }

      .metronome-control-row.disabled {
        opacity: 0.4;
        pointer-events: none;
      }

      .btn-metronome-compact {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        background: ${this.isDarkTheme ? '#3f3f3f' : '#e8e8e8'};
        color: ${textPrimary};
        border: 1px solid ${inputBorder};
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .btn-metronome-compact:hover {
        background: ${this.isDarkTheme ? '#505050' : '#d8d8d8'};
      }

      .btn-metronome-compact.active {
        background: ${this.isDarkTheme ? '#3d3020' : '#f5f0e8'};
        border-color: #8B6F47;
        color: ${this.isDarkTheme ? '#d4a574' : '#6b5330'};
      }

      .btn-metronome-compact .metronome-icon {
        font-size: 14px;
      }

      .btn-metronome-compact .metronome-status {
        font-weight: 600;
      }

      .volume-control-compact {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .volume-icon-small {
        font-size: 12px;
        opacity: 0.7;
      }

      .volume-slider-compact {
        width: 50px;
        height: 3px;
        -webkit-appearance: none;
        appearance: none;
        background: ${this.isDarkTheme ? '#555' : '#ccc'};
        border-radius: 2px;
        outline: none;
        cursor: pointer;
      }

      .volume-slider-compact::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 10px;
        height: 10px;
        background: #8B6F47;
        border-radius: 50%;
        cursor: pointer;
      }

      .volume-slider-compact::-moz-range-thumb {
        width: 10px;
        height: 10px;
        background: #8B6F47;
        border-radius: 50%;
        cursor: pointer;
        border: none;
      }

      /* Legacy styles (kept for compatibility) */
      .metronome-toggle-row {
        margin-top: 8px;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .btn-metronome-toggle {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        padding: 10px 12px;
        background: ${this.isDarkTheme ? '#3f3f3f' : '#e8e8e8'};
        color: ${textPrimary};
        border: 1px solid ${inputBorder};
        border-radius: 4px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .btn-metronome-toggle:hover {
        background: ${this.isDarkTheme ? '#505050' : '#d8d8d8'};
      }

      .btn-metronome-toggle.active {
        background: ${this.isDarkTheme ? '#3d3020' : '#f5f0e8'};
        border-color: #8B6F47;
        color: ${this.isDarkTheme ? '#d4a574' : '#6b5330'};
      }

      .btn-metronome-toggle.active:hover {
        background: ${this.isDarkTheme ? '#4a3a28' : '#ebe5d8'};
      }

      .metronome-icon {
        font-size: 16px;
      }

      .metronome-label {
        flex: 1;
        text-align: left;
      }

      .metronome-volume-control {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 6px 8px;
        background: ${this.isDarkTheme ? '#3f3f3f' : '#e8e8e8'};
        border: 1px solid ${inputBorder};
        border-radius: 4px;
      }

      .volume-icon {
        font-size: 14px;
        opacity: 0.8;
      }

      .volume-slider {
        width: 60px;
        height: 4px;
        -webkit-appearance: none;
        appearance: none;
        background: ${this.isDarkTheme ? '#555' : '#ccc'};
        border-radius: 2px;
        outline: none;
        cursor: pointer;
      }

      .volume-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 12px;
        height: 12px;
        background: #8B6F47;
        border-radius: 50%;
        cursor: pointer;
      }

      .volume-slider::-moz-range-thumb {
        width: 12px;
        height: 12px;
        background: #8B6F47;
        border-radius: 50%;
        cursor: pointer;
        border: none;
      }

      /* Loop Create Bar (compact) */
      .loop-create-bar {
        display: flex;
        gap: 6px;
        align-items: center;
        padding: 8px 16px;
        background: ${bgSecondary};
        border-bottom: 1px solid ${borderColor};
      }

      .loop-create-bar .label-input-wrapper {
        flex: 1;
      }

      .loop-create-bar .label-input {
        width: 100%;
        padding: 6px 28px 6px 10px;
        font-size: 12px;
      }

      .loop-create-bar .custom-bars-dropdown {
        flex: 0 0 70px;
      }

      .loop-create-bar .custom-bars-dropdown .bars-dropdown-trigger {
        padding: 6px 8px;
        font-size: 12px;
      }

      .loop-create-bar #createSegment {
        flex: 0 0 32px;
        width: 32px;
        height: 32px;
        padding: 0;
        font-size: 18px;
        font-weight: 600;
        border-radius: 4px;
      }

      /* Legacy styles (kept for compatibility) */
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
        padding: 8px;
        border-radius: 8px;
        width: 100%;
        flex: 1;
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

      .btn-count-in {
        background: ${this.isDarkTheme ? '#3f3f3f' : '#f9f9f9'};
        color: ${textSecondary};
        border: 1px solid ${borderColor};
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 6px;
        border-radius: 6px;
        width: 100%;
        min-width: 48px;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 1px;
      }

      .btn-count-in:hover:not(:disabled) {
        background: ${this.isDarkTheme ? '#4f4f4f' : '#f2f2f2'};
      }

      .btn-count-in:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .btn-count-in.active {
        background: ${this.isDarkTheme ? '#4a3a6b' : '#ede7f6'};
        color: ${this.isDarkTheme ? '#ce93d8' : '#7b1fa2'};
        border-color: #9c27b0;
      }

      .btn-count-in .count-in-label {
        font-family: 'Roboto Mono', monospace;
      }

      /* Count-In Display (Beat Navigation) */
      .count-in-display {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 12px;
        padding: 8px 0;
      }

      .count-beat {
        font-size: 22px;
        font-weight: 700;
        color: ${textSecondary};
        opacity: 0.4;
        transition: all 0.1s ease;
        font-family: 'Roboto Mono', monospace;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
      }

      .count-beat.active {
        color: ${this.isDarkTheme ? '#ce93d8' : '#7b1fa2'};
        opacity: 1;
        transform: scale(1.2);
        background: ${this.isDarkTheme ? '#4a3a6b' : '#ede7f6'};
      }

      /* Metronome mode (wood tone) */
      .count-in-display.metronome-mode .count-beat.active {
        color: ${this.isDarkTheme ? '#d4a574' : '#8b5a2b'};
        background: ${this.isDarkTheme ? '#4a3928' : '#f5e6d3'};
      }

      .segments-list {
        max-height: 500px;
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
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        font-size: 11px;
        color: ${textSecondary};
        font-family: 'Courier New', monospace;
        white-space: nowrap;
        margin-right: 8px;
        line-height: 1.3;
        flex-shrink: 0;
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

      /* 루프 버튼 컨테이너 (C 배지 포함) */
      .loop-btn-container {
        position: relative;
        display: inline-flex;
      }

      .custom-sync-badge {
        position: absolute;
        top: -4px;
        right: -4px;
        background: #ff9800;
        color: white;
        font-size: 9px;
        font-weight: bold;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
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

      .label-input-wrapper {
        position: relative;
        display: flex;
        flex: 1;
        min-width: 0;
      }

      .label-input {
        flex: 1;
        padding: 4px 28px 4px 8px;
        border: 1px solid ${inputBorder};
        border-radius: 2px;
        font-size: 11px;
        background: ${inputBg};
        color: ${textPrimary};
        cursor: text;
        appearance: none;
        -webkit-appearance: none;
        -moz-appearance: none;
        min-width: 0;
      }

      .label-input:focus {
        outline: none;
        border-color: #065fd4;
      }

      .label-dropdown-toggle {
        position: absolute;
        right: 1px;
        top: 1px;
        bottom: 1px;
        width: 24px;
        background: transparent;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: ${textSecondary};
        padding: 0;
      }

      .label-dropdown-toggle:hover {
        color: ${textPrimary};
      }

      .label-dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: ${bgPrimary};
        border: 1px solid ${borderColor};
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 1000;
        margin-top: 2px;
        max-height: 200px;
        overflow-y: auto;
      }

      .label-option {
        padding: 8px 12px;
        font-size: 13px;
        color: ${textPrimary};
        cursor: pointer;
        transition: background 0.1s;
      }

      .label-option:hover {
        background: ${hoverBg};
      }

      .label-option:first-child {
        border-radius: 4px 4px 0 0;
      }

      .label-option:last-child {
        border-radius: 0 0 4px 4px;
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

      /* Custom Bars Dropdown */
      .custom-bars-dropdown {
        position: relative;
        display: inline-block;
      }

      .bars-dropdown-trigger {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 4px 6px;
        border: 1px solid ${inputBorder};
        border-radius: 2px;
        background: ${inputBg};
        color: ${textPrimary};
        font-size: 10px;
        cursor: pointer;
        min-width: 65px;
        gap: 4px;
      }

      .bars-dropdown-trigger:hover {
        border-color: ${textSecondary};
      }

      .bars-dropdown-trigger:focus {
        outline: none;
        border-color: #065fd4;
      }

      .bars-arrow {
        width: 10px;
        height: 10px;
        transition: transform 0.15s;
        flex-shrink: 0;
      }

      .bars-dropdown-trigger.open .bars-arrow {
        transform: rotate(180deg);
      }

      .bars-dropdown-panel {
        position: fixed;
        min-width: 100px;
        background: ${bgPrimary};
        border: 1px solid ${borderColor};
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        overflow: hidden;
      }

      .scroll-indicator {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 4px;
        background: ${bgSecondary};
        color: ${textSecondary};
        font-size: 10px;
        cursor: pointer;
        user-select: none;
      }

      .scroll-indicator:hover {
        background: ${hoverBg};
        color: ${textPrimary};
      }

      .scroll-indicator.hidden {
        display: none;
      }

      .scroll-up {
        border-bottom: 1px solid ${borderColor};
      }

      .scroll-down {
        border-top: 1px solid ${borderColor};
      }

      .bars-options-container {
        max-height: 200px;
        overflow-y: auto;
        scrollbar-width: thin;
      }

      .bars-options-container::-webkit-scrollbar {
        width: 6px;
      }

      .bars-options-container::-webkit-scrollbar-thumb {
        background: ${borderColor};
        border-radius: 3px;
      }

      .bars-section-label {
        padding: 6px 10px 4px;
        font-size: 9px;
        font-weight: 600;
        color: ${textSecondary};
        text-transform: uppercase;
        letter-spacing: 0.5px;
        background: ${bgSecondary};
        position: sticky;
        top: 0;
      }

      .bars-option {
        padding: 6px 10px;
        font-size: 11px;
        color: ${textPrimary};
        cursor: pointer;
        transition: background 0.1s;
      }

      .bars-option:hover {
        background: ${hoverBg};
      }

      .bars-option.selected {
        background: ${this.isDarkTheme ? '#065fd430' : '#065fd420'};
        color: #065fd4;
        font-weight: 500;
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
        position: fixed;
        background: ${bgPrimary};
        border: 1px solid ${borderColor};
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        min-width: 120px;
        z-index: 10000;
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

      /* Add 8 bars 버튼 */
      .btn-add-8-bars {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        width: 100%;
        padding: 4px 8px;
        margin-top: 6px;
        background: transparent;
        border: none;
        border-top: 1px dashed ${borderColor};
        border-radius: 0;
        color: ${textSecondary};
        font-size: 11px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .btn-add-8-bars:hover:not(.disabled) {
        color: #065fd4;
      }

      .btn-add-8-bars.disabled {
        cursor: default;
        opacity: 0.6;
        font-style: italic;
      }

      .btn-add-8-bars svg {
        flex-shrink: 0;
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

    // Quantize All 버튼
    const quantizeAllBtn = this.ui.querySelector('#quantizeAllBtn');
    if (quantizeAllBtn) {
      quantizeAllBtn.addEventListener('click', () => {
        this.onCommand?.('quantize-all', {});
      });
    }

    // 세그먼트 라벨 input에서 YouTube 단축키 비활성화
    const segmentLabelInput = this.ui.querySelector<HTMLInputElement>('#segmentLabel');
    if (segmentLabelInput) {
      this.preventYouTubeShortcuts(segmentLabelInput);
    }

    // 라벨 드롭다운 토글 버튼
    const labelDropdownToggle = this.ui.querySelector('#labelDropdownToggle');
    if (labelDropdownToggle) {
      labelDropdownToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleLabelDropdown();
      });
    }

    // 라벨 드롭다운 옵션 클릭
    const labelDropdown = this.ui.querySelector('#labelDropdown');
    if (labelDropdown) {
      labelDropdown.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('label-option')) {
          const value = target.getAttribute('data-value');
          if (value && segmentLabelInput) {
            segmentLabelInput.value = value;
            segmentLabelInput.focus();
          }
          this.closeLabelDropdown();
        }
      });
    }

    // 외부 클릭 시 드롭다운 닫기
    document.addEventListener('click', (e) => {
      const labelWrapper = this.ui.querySelector('.label-input-wrapper');
      if (labelWrapper && !labelWrapper.contains(e.target as Node)) {
        this.closeLabelDropdown();
      }

      // bars 드롭다운도 외부 클릭 시 닫기
      if (this.openBarsDropdownId) {
        const openDropdown = this.ui.querySelector(`[data-dropdown-id="${this.openBarsDropdownId}"]`);
        if (openDropdown && !openDropdown.contains(e.target as Node)) {
          this.closeAllBarsDropdowns();
        }
      }
    });

    // 페이지 스크롤 시 bars 드롭다운 닫기 (fixed position이므로 스크롤 시 위치 어긋남 방지)
    window.addEventListener('scroll', () => {
      if (this.openBarsDropdownId) {
        this.closeAllBarsDropdowns();
      }
    }, true); // capture phase로 모든 스크롤 이벤트 감지

    // 커스텀 bars 드롭다운 이벤트 설정
    this.setupBarsDropdownListeners();

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

    // Tap Sync 버튼 - mousedown 사용으로 레이턴시 최소화
    const tapSyncBtn = this.ui.querySelector('#tapSyncBtn');
    if (tapSyncBtn) {
      // mousedown은 click보다 빠름 (click은 mouseup 후 발생)
      tapSyncBtn.addEventListener('mousedown', (e) => {
        e.preventDefault(); // 텍스트 선택 방지
        this.handleTapSync();
      });
      // 마우스 올릴 때 AudioContext 워밍업 (첫 클릭 레이턴시 감소)
      tapSyncBtn.addEventListener('mouseenter', () => {
        this.tapSyncMetronome.warmup();
      });
    }

    // 미세 조정 버튼들
    const syncMinus1 = this.ui.querySelector('#syncMinus1');
    if (syncMinus1) {
      syncMinus1.addEventListener('click', () => this.handleSyncFineTune(-0.001));
    }

    const syncMinus10 = this.ui.querySelector('#syncMinus10');
    if (syncMinus10) {
      syncMinus10.addEventListener('click', () => this.handleSyncFineTune(-0.01));
    }

    const syncPlus10 = this.ui.querySelector('#syncPlus10');
    if (syncPlus10) {
      syncPlus10.addEventListener('click', () => this.handleSyncFineTune(0.01));
    }

    const syncPlus1 = this.ui.querySelector('#syncPlus1');
    if (syncPlus1) {
      syncPlus1.addEventListener('click', () => this.handleSyncFineTune(0.001));
    }

    // 싱크 초기화 버튼
    const syncClear = this.ui.querySelector('#syncClear');
    if (syncClear) {
      syncClear.addEventListener('click', () => this.handleSyncClear());
    }

    // 오프셋 더블클릭 편집
    const syncOffsetDisplay = this.ui.querySelector('#syncOffsetDisplay');
    const syncOffsetInput = this.ui.querySelector('#syncOffsetInput') as HTMLInputElement;
    if (syncOffsetDisplay && syncOffsetInput) {
      syncOffsetDisplay.addEventListener('dblclick', () => {
        const currentOffset = this.profile?.globalMetronomeOffset ?? 0;
        syncOffsetInput.value = this.formatTime(currentOffset);
        (syncOffsetDisplay as HTMLElement).style.display = 'none';
        syncOffsetInput.style.display = 'block';
        syncOffsetInput.focus();
        syncOffsetInput.select();
      });

      syncOffsetInput.addEventListener('blur', () => {
        this.handleOffsetInputConfirm(syncOffsetDisplay as HTMLElement, syncOffsetInput);
      });

      syncOffsetInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleOffsetInputConfirm(syncOffsetDisplay as HTMLElement, syncOffsetInput);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.handleOffsetInputCancel(syncOffsetDisplay as HTMLElement, syncOffsetInput);
        }
      });
    }

    // 글로벌 메트로놈 토글 버튼
    const globalMetronomeToggle = this.ui.querySelector('#globalMetronomeToggle');
    if (globalMetronomeToggle) {
      globalMetronomeToggle.addEventListener('click', () => this.handleGlobalMetronomeToggle());
    }

    // 메트로놈 볼륨 슬라이더
    const volumeSlider = this.ui.querySelector('#metronomeVolume') as HTMLInputElement;
    if (volumeSlider) {
      volumeSlider.addEventListener('input', (e) => {
        const value = parseInt((e.target as HTMLInputElement).value, 10);
        this.handleMetronomeVolumeChange(value);
      });
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
    // 커스텀 드롭다운에서 값 가져오기
    const durationDropdown = this.ui.querySelector('[data-dropdown-id="loopDuration"]');
    const durationTrigger = durationDropdown?.querySelector('.bars-dropdown-trigger') as HTMLElement;

    const label = labelInput?.value?.trim() || '';
    const durationValue = durationTrigger?.getAttribute('data-value') || 'bar:8';

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

    // 버튼 내부 요소(SVG, SPAN 등) 클릭 시 부모 버튼 찾기
    let buttonElement = target;
    if (target.tagName !== 'BUTTON' && target.tagName !== 'INPUT') {
      const closestButton = target.closest('button');
      if (closestButton) {
        buttonElement = closestButton as HTMLElement;
        console.log('버튼 내부 요소 클릭 감지, 부모 버튼 찾음:', buttonElement);
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
      case 'duplicate':
        console.log('duplicate 액션 실행');
        this.closeAllMenus();
        this.onCommand?.('duplicate-segment', { segmentId });
        break;
      case 'quantize':
        console.log('quantize 액션 실행');
        this.closeAllMenus();
        this.onCommand?.('quantize-segment', { segmentId });
        break;
      case 'open-beat-sync':
        console.log('open-beat-sync 액션 실행');
        this.closeAllMenus();
        this.openBeatSyncModal(segmentId);
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
      case 'add-8-bars':
        console.log('add-8-bars 액션 실행');
        this.onCommand?.('add-8-bars', { segmentId });
        break;
      case 'toggle-count-in':
        console.log('toggle-count-in 액션 실행');
        this.onCommand?.('toggle-count-in', { segmentId });
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

    const menuBtn = this.ui.querySelector(`.btn-menu[data-segment-id="${segmentId}"]`) as HTMLElement;
    if (!menuBtn) return;

    const isOpen = menu.style.display !== 'none';

    // 모든 메뉴 닫기
    this.closeAllMenus();

    // 현재 메뉴가 닫혀있었다면 열기
    if (!isOpen) {
      // position: fixed를 위해 버튼 위치 기준으로 메뉴 위치 계산
      const btnRect = menuBtn.getBoundingClientRect();
      const menuHeight = 80; // 대략적인 메뉴 높이 (2개 아이템)
      const spaceBelow = window.innerHeight - btnRect.bottom;

      menu.style.display = 'block';

      // 아래 공간이 부족하면 위로 열기
      if (spaceBelow < menuHeight + 10) {
        menu.style.top = `${btnRect.top - menuHeight - 4}px`;
      } else {
        menu.style.top = `${btnRect.bottom + 4}px`;
      }
      menu.style.right = `${window.innerWidth - btnRect.right}px`;

      // 클린업 함수
      const cleanup = () => {
        document.removeEventListener('click', closeOnOutsideClick);
        window.removeEventListener('scroll', closeOnScroll, true);
        window.removeEventListener('wheel', closeOnWheel, true);
      };

      // 외부 클릭 시 메뉴 닫기
      const closeOnOutsideClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.menu-container')) {
          this.closeAllMenus();
          cleanup();
        }
      };

      // 스크롤 시 메뉴 닫기
      const closeOnScroll = () => {
        this.closeAllMenus();
        cleanup();
      };

      // 휠 이벤트 시 메뉴 닫기 (YouTube 페이지 스크롤 감지용)
      const closeOnWheel = () => {
        this.closeAllMenus();
        cleanup();
      };

      // 약간의 딜레이 후 클릭 리스너 등록 (현재 클릭 이벤트와 충돌 방지)
      setTimeout(() => {
        document.addEventListener('click', closeOnOutsideClick);
      }, 0);

      // 스크롤/휠 리스너는 즉시 등록
      window.addEventListener('scroll', closeOnScroll, true);
      window.addEventListener('wheel', closeOnWheel, true);
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
   * 더블클릭 시 키보드 입력 모드로 전환
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

    const segmentId = target.getAttribute('data-segment-id');
    const timeType = target.getAttribute('data-time-type') as 'start' | 'end';

    if (!segmentId || !timeType) return;

    // 더블클릭 감지
    const clickKey = `time-${segmentId}-${timeType}`;
    const now = Date.now();
    const lastClick = this.lastClickTime.get(clickKey) || 0;
    this.lastClickTime.set(clickKey, now);

    if (now - lastClick < 300) {
      // 더블클릭: 키보드 입력 모드로 전환
      e.preventDefault();
      this.enableTimeKeyboardInput(target, segmentId, timeType);
      return;
    }

    e.preventDefault();

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
   * Time 입력 필드를 키보드 입력 모드로 전환
   */
  private enableTimeKeyboardInput(input: HTMLInputElement, segmentId: string, timeType: 'start' | 'end') {
    const segment = this.profile?.segments.find(s => s.id === segmentId);
    const originalValue = segment ? (timeType === 'start' ? segment.start : segment.end) : 0;

    // 포커스 및 선택
    input.style.cursor = 'text';
    input.focus();
    input.select();

    const restoreState = () => {
      input.style.cursor = 'ns-resize';
    };

    const handleBlur = () => {
      restoreState();
      input.removeEventListener('blur', handleBlur);
      input.removeEventListener('keydown', handleKeydown);

      // 값 파싱 및 저장
      const parsedValue = this.parseTimeInput(input.value);
      if (parsedValue !== null) {
        this.onCommand?.('update-time', { segmentId, timeType, time: parsedValue });
      } else {
        // 잘못된 값이면 원래 값으로 복원
        input.value = this.formatTime(originalValue);
      }
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        input.value = this.formatTime(originalValue);
        input.blur();
      }
    };

    input.addEventListener('blur', handleBlur);
    input.addEventListener('keydown', handleKeydown);
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
   * 더블클릭 시 키보드 입력 모드로 전환
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

    const segmentId = target.getAttribute('data-segment-id');
    if (!segmentId) return;

    // 더블클릭 감지
    const clickKey = `rate-${segmentId}`;
    const now = Date.now();
    const lastClick = this.lastClickTime.get(clickKey) || 0;
    this.lastClickTime.set(clickKey, now);

    if (now - lastClick < 300) {
      // 더블클릭: 키보드 입력 모드로 전환
      e.preventDefault();
      this.enableRateKeyboardInput(target, segmentId);
      return;
    }

    e.preventDefault();

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
   * Rate 입력 필드를 키보드 입력 모드로 전환
   */
  private enableRateKeyboardInput(input: HTMLInputElement, segmentId: string) {
    const segment = this.profile?.segments.find(s => s.id === segmentId);
    const originalRate = segment?.rate || 1.0;
    const originalValue = Math.round(originalRate * 100);

    // readonly 속성 제거 및 포커스
    input.removeAttribute('readonly');
    input.style.cursor = 'text';
    input.focus();
    input.select();

    const restoreState = () => {
      input.setAttribute('readonly', '');
      input.style.cursor = 'ns-resize';
    };

    const handleBlur = () => {
      restoreState();
      input.removeEventListener('blur', handleBlur);
      input.removeEventListener('keydown', handleKeydown);

      // 값 파싱 및 저장
      const parsedValue = parseInt(input.value, 10);
      if (!isNaN(parsedValue) && parsedValue >= 5 && parsedValue <= 160) {
        const newRate = parsedValue / 100;
        this.onCommand?.('update-rate', { segmentId, rate: newRate });
      } else {
        // 잘못된 값이면 원래 값으로 복원
        input.value = originalValue.toString();
      }
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        input.value = originalValue.toString();
        input.blur();
      }
    };

    input.addEventListener('blur', handleBlur);
    input.addEventListener('keydown', handleKeydown);
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
   * 시간을 포맷합니다. (mm:ss.xxx 형식)
   */
  private formatTime(seconds: number): string {
    if (typeof seconds !== 'number' || isNaN(seconds)) {
      return '00:00.000';
    }

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
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
   * 더블클릭 시 키보드 입력 모드로 전환
   */
  private handleTempoInputMouseDown(e: MouseEvent) {
    const target = e.target as HTMLInputElement;

    // 포커스 상태면 드래그 안 함 (이미 편집 모드)
    if (document.activeElement === target) {
      return;
    }

    // 더블클릭 감지
    const now = Date.now();
    const lastClick = this.lastClickTime.get('tempo') || 0;
    this.lastClickTime.set('tempo', now);

    if (now - lastClick < 300) {
      // 더블클릭: 키보드 입력 모드로 전환
      e.preventDefault();
      this.enableTempoKeyboardInput(target);
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
   * Tempo 입력 필드를 키보드 입력 모드로 전환
   */
  private enableTempoKeyboardInput(input: HTMLInputElement) {
    const currentValue = input.value.trim();

    // "---"인 경우 빈 값으로 시작
    if (currentValue === '---') {
      input.value = '';
    }

    // readonly 속성 제거 및 포커스
    input.readOnly = false;
    input.style.cursor = 'text';
    input.focus();
    input.select();

    const restoreState = () => {
      input.readOnly = false;
      input.style.cursor = 'ns-resize';

      // 값이 비어있으면 "---"로 복원
      if (input.value.trim() === '') {
        input.value = '---';
      }
    };

    const handleBlur = () => {
      restoreState();
      input.removeEventListener('blur', handleBlur);
      input.removeEventListener('keydown', handleKeydown);
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        // 원래 값으로 복원
        input.value = this.profile?.tempo?.toString() || '---';
        input.blur();
      }
    };

    input.addEventListener('blur', handleBlur);
    input.addEventListener('keydown', handleKeydown);
  }

  /**
   * Tap Tempo 버튼 클릭 처리
   *
   * 개선된 알고리즘:
   * 1. 더블 클릭 필터: 50ms 이하 간격 무시 (실수로 인한 더블 클릭 방지)
   * 2. 가중치 평균: 최근 탭에 높은 가중치 부여 (안정성 향상)
   * 3. 이상치 리셋: 평균에서 ±50% 벗어나면 새 템포로 인식 (REAPER 스타일)
   */
  private tapTimes: number[] = [];
  private handleTapTempo() {
    const now = Date.now();

    // 마지막 탭으로부터 2초 이상 지났으면 리셋
    if (this.tapTimes.length > 0 && now - this.tapTimes[this.tapTimes.length - 1] > 2000) {
      this.tapTimes = [];
    }

    // 더블 클릭 필터: 50ms 이하 간격 무시 (1200 BPM 이상은 비현실적)
    if (this.tapTimes.length > 0) {
      const lastInterval = now - this.tapTimes[this.tapTimes.length - 1];
      if (lastInterval < 50) {
        return; // 너무 빠른 탭은 무시
      }
    }

    // 이상치 리셋 (REAPER 스타일): 현재 평균에서 ±50% 벗어나면 새 템포로 인식
    if (this.tapTimes.length >= 2) {
      const lastInterval = now - this.tapTimes[this.tapTimes.length - 1];
      const currentAvgInterval = this.calculateCurrentAverageInterval();

      // 새 간격이 현재 평균의 50% 미만이거나 150% 초과면 리셋
      if (lastInterval < currentAvgInterval * 0.5 || lastInterval > currentAvgInterval * 1.5) {
        this.tapTimes = []; // 완전히 새로운 템포 시작
      }
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

    // 간격 계산
    const intervals: number[] = [];
    for (let i = 1; i < this.tapTimes.length; i++) {
      intervals.push(this.tapTimes[i] - this.tapTimes[i - 1]);
    }

    // 가중치 평균: 최근 탭일수록 높은 가중치 (1, 2, 3, ... n)
    const weights = intervals.map((_, i) => i + 1);
    const weightedSum = intervals.reduce((sum, interval, i) => sum + interval * weights[i], 0);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const avgInterval = weightedSum / totalWeight;

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
   * 현재 탭 간격의 평균 계산 (이상치 감지용)
   */
  private calculateCurrentAverageInterval(): number {
    if (this.tapTimes.length < 2) return 0;

    const intervals: number[] = [];
    for (let i = 1; i < this.tapTimes.length; i++) {
      intervals.push(this.tapTimes[i] - this.tapTimes[i - 1]);
    }

    return intervals.reduce((a, b) => a + b, 0) / intervals.length;
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
   * Tap Sync 버튼 클릭 핸들러
   * 모든 박자의 탭을 수집하여 첫박 오프셋을 정밀하게 계산합니다.
   * 탭이 누적될수록 평균값이 더 정확해지고, 점수가 표시됩니다.
   */
  private handleTapSync() {
    if (!this.profile?.tempo || !this.profile?.timeSignature) {
      return;
    }

    // TAP Sync 중에는 글로벌 메트로놈 OFF
    if (this.isGlobalMetronomeEnabled) {
      this.isGlobalMetronomeEnabled = false;
      this.onCommand?.('toggle-global-metronome', { enabled: false });
    }

    const beatsPerBar = parseInt(this.profile.timeSignature.split('/')[0], 10);
    const bpm = this.profile.tempo;
    const beatDuration = 60 / bpm;

    // 현재 박자 증가 (1, 2, 3, 4, 1, 2, 3, 4, ...)
    this.tapSyncCurrentBeat = (this.tapSyncCurrentBeat % beatsPerBar) + 1;

    // 박자에 따른 소리 피드백 재생
    this.playBeatSound(this.tapSyncCurrentBeat, beatsPerBar);

    // 5초 이상 탭이 없으면 히스토리 리셋
    const now = Date.now();
    if (now - this.tapSyncLastResetTime > 5000 && this.tapSyncHistory.length > 0) {
      this.tapSyncHistory = [];
      this.tapSyncScore = 0;
    }
    this.tapSyncLastResetTime = now;

    // 현재 탭 기록 및 첫박 오프셋 계산
    this.onCommand?.('get-current-time', {
      callback: (currentTime: number) => {
        // 현재 박자 번호를 기반으로 첫박 시간 역산
        // beatNumber가 1이면 현재 시간이 첫박
        // beatNumber가 2이면 현재 시간 - 1*beatDuration이 첫박
        // beatNumber가 N이면 현재 시간 - (N-1)*beatDuration이 첫박
        const beatsFromDownbeat = this.tapSyncCurrentBeat - 1;
        const estimatedDownbeatTime = currentTime - (beatsFromDownbeat * beatDuration);

        // 첫박 오프셋 계산 (barDuration으로 모듈러)
        const barDuration = beatDuration * beatsPerBar;
        let calculatedOffset = estimatedDownbeatTime % barDuration;
        if (calculatedOffset < 0) calculatedOffset += barDuration;

        // 히스토리에 추가
        this.tapSyncHistory.push({
          beatNumber: this.tapSyncCurrentBeat,
          tappedTime: currentTime,
          calculatedOffset
        });

        // 최근 16개만 유지
        if (this.tapSyncHistory.length > 16) {
          this.tapSyncHistory.shift();
        }

        // 평균 오프셋 계산 및 점수 산출
        if (this.tapSyncHistory.length >= 2) {
          const { averageOffset, score } = this.calculateTapSyncResult(barDuration);

          this.tapSyncScore = score;

          // 글로벌 오프셋 업데이트
          this.onCommand?.('update-global-sync', { offset: averageOffset });
        } else if (this.tapSyncHistory.length === 1) {
          // 첫 번째 탭은 그대로 사용
          this.tapSyncScore = 0;
          this.onCommand?.('update-global-sync', { offset: calculatedOffset });
        }

        // UI 업데이트
        this.render();
        this.setupEventListeners();
      }
    });
  }

  /**
   * TAP Sync 결과 계산: 평균 오프셋과 정확도 점수
   * @param barDuration 한 마디 길이 (초)
   * @returns { averageOffset, score }
   */
  private calculateTapSyncResult(barDuration: number): { averageOffset: number; score: number } {
    if (this.tapSyncHistory.length < 2) {
      return { averageOffset: 0, score: 0 };
    }

    const offsets = this.tapSyncHistory.map(t => t.calculatedOffset);

    // 원형 평균 계산 (0과 barDuration이 인접한 값이므로)
    // 각 오프셋을 각도로 변환하여 평균 계산
    let sinSum = 0;
    let cosSum = 0;
    for (const offset of offsets) {
      const angle = (offset / barDuration) * 2 * Math.PI;
      sinSum += Math.sin(angle);
      cosSum += Math.cos(angle);
    }
    const avgAngle = Math.atan2(sinSum / offsets.length, cosSum / offsets.length);
    let averageOffset = (avgAngle / (2 * Math.PI)) * barDuration;
    if (averageOffset < 0) averageOffset += barDuration;

    // 표준편차 계산 (원형 거리 기준)
    let varianceSum = 0;
    for (const offset of offsets) {
      // 원형 거리: 두 오프셋 간의 최소 거리
      let diff = Math.abs(offset - averageOffset);
      if (diff > barDuration / 2) diff = barDuration - diff;
      varianceSum += diff * diff;
    }
    const stdDev = Math.sqrt(varianceSum / offsets.length);
    const stdDevMs = stdDev * 1000; // ms로 변환

    // === 1. 일관성 점수 (기존 로직) ===
    // 비선형 점수 계산 (인간 청각 인지 기반)
    // 15ms 이하: 90-100% (매우 정밀, 프로 수준)
    // 25ms: 80% (좋음, 인지 불가 수준)
    // 40ms: 50% (보통, 약간 느껴짐)
    // 60ms+: 0% (부정확, 명확히 어긋남)
    let consistencyScore: number;
    if (stdDevMs <= 15) {
      consistencyScore = 90 + (1 - stdDevMs / 15) * 10;
    } else if (stdDevMs <= 25) {
      consistencyScore = 80 + (1 - (stdDevMs - 15) / 10) * 10;
    } else if (stdDevMs <= 40) {
      consistencyScore = 50 + (1 - (stdDevMs - 25) / 15) * 30;
    } else if (stdDevMs <= 60) {
      consistencyScore = (1 - (stdDevMs - 40) / 20) * 50;
    } else {
      consistencyScore = 0;
    }

    // === 2. 템포 정확도 점수 (신규) ===
    // 탭 간격을 분석하여 실제 BPM과 설정된 BPM 비교
    let tempoScore = 100;
    if (this.tapSyncHistory.length >= 3 && this.profile?.tempo) {
      const tappedTimes = this.tapSyncHistory.map(t => t.tappedTime);
      const intervals: number[] = [];
      for (let i = 1; i < tappedTimes.length; i++) {
        intervals.push(tappedTimes[i] - tappedTimes[i - 1]);
      }

      // 평균 탭 간격 (초)
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

      // 설정된 BPM 기준 beat 간격 (초)
      const expectedBeatDuration = 60 / this.profile.tempo;

      // 템포 오차율 계산 (%)
      // avgInterval이 expectedBeatDuration과 얼마나 차이나는지
      const tempoErrorPercent = Math.abs(avgInterval - expectedBeatDuration) / expectedBeatDuration * 100;

      // 템포 정확도 점수 계산
      // 0-2%: 100점 (거의 완벽)
      // 2-5%: 80-100점 (좋음)
      // 5-10%: 50-80점 (보통)
      // 10-15%: 20-50점 (부정확)
      // 15%+: 0-20점 (많이 벗어남)
      if (tempoErrorPercent <= 2) {
        tempoScore = 100;
      } else if (tempoErrorPercent <= 5) {
        tempoScore = 80 + (1 - (tempoErrorPercent - 2) / 3) * 20;
      } else if (tempoErrorPercent <= 10) {
        tempoScore = 50 + (1 - (tempoErrorPercent - 5) / 5) * 30;
      } else if (tempoErrorPercent <= 15) {
        tempoScore = 20 + (1 - (tempoErrorPercent - 10) / 5) * 30;
      } else {
        tempoScore = Math.max(0, 20 - (tempoErrorPercent - 15) * 2);
      }
    }

    // === 3. 최종 점수: 일관성 70% + 템포 정확도 30% ===
    // 일관성이 더 중요하지만, 템포가 많이 벗어나면 감점
    const finalScore = consistencyScore * 0.7 + tempoScore * 0.3;

    return { averageOffset, score: Math.round(finalScore) };
  }

  /**
   * 박자에 따른 소리를 재생합니다.
   * 1박: 강한 클릭 (낮은 음), 나머지: 약한 클릭 (높은 음)
   */
  private playBeatSound(beat: number, _beatsPerBar: number) {
    const isDownbeat = beat === 1;
    this.tapSyncMetronome.playClickNow(isDownbeat);
  }

  /**
   * 싱크 미세 조정 핸들러
   * @param delta 조정값 (초 단위, 예: 0.01 = +10ms, -0.01 = -10ms, 0.001 = +1ms)
   */
  private handleSyncFineTune(delta: number) {
    if (!this.profile) return;

    const currentOffset = this.profile.globalMetronomeOffset || 0;
    const newOffset = Math.max(0, currentOffset + delta); // 0 이상으로 제한

    this.onCommand?.('update-global-sync', { offset: newOffset });

    // UI 업데이트
    this.render();
    this.setupEventListeners();
  }

  /**
   * 싱크 초기화 핸들러
   */
  private handleSyncClear() {
    this.tapSyncCurrentBeat = 0;
    this.isGlobalMetronomeEnabled = false;

    // TAP Sync 히스토리 초기화
    this.tapSyncHistory = [];
    this.tapSyncScore = 0;
    this.tapSyncLastResetTime = 0;

    this.onCommand?.('clear-global-sync', {});
    this.onCommand?.('toggle-global-metronome', { enabled: false });

    // UI 업데이트
    this.render();
    this.setupEventListeners();
  }

  /**
   * 오프셋 입력 확인 핸들러
   */
  private handleOffsetInputConfirm(display: HTMLElement, input: HTMLInputElement) {
    const value = this.parseTimeInput(input.value);

    if (value !== null && value >= 0) {
      // 새 오프셋 값으로 업데이트
      this.onCommand?.('set-global-offset', { offset: value });

      // 직접 입력 시 TAP Sync 점수 리셋 (점수가 의미 없음)
      this.tapSyncHistory = [];
      this.tapSyncScore = 0;

      // 디스플레이 업데이트 및 표시 전환
      display.textContent = this.formatSyncTime(value);

      // UI 업데이트 (점수 표시 갱신)
      this.render();
      this.setupEventListeners();
    }

    display.style.display = '';
    input.style.display = 'none';
  }

  /**
   * 오프셋 입력 취소 핸들러
   */
  private handleOffsetInputCancel(display: HTMLElement, input: HTMLInputElement) {
    display.style.display = '';
    input.style.display = 'none';
  }

  /**
   * 글로벌 메트로놈 토글 핸들러
   */
  private handleGlobalMetronomeToggle() {
    this.isGlobalMetronomeEnabled = !this.isGlobalMetronomeEnabled;

    this.onCommand?.('toggle-global-metronome', { enabled: this.isGlobalMetronomeEnabled });

    // UI 업데이트
    this.render();
    this.setupEventListeners();
  }

  /**
   * 메트로놈 볼륨 변경 핸들러
   * @param volume 볼륨 (0-100)
   */
  private handleMetronomeVolumeChange(volume: number) {
    this.metronomeVolume = volume;

    // TAP Sync 피드백용 메트로놈 볼륨 업데이트
    this.tapSyncMetronome.setVolume(volume / 100);

    // 글로벌 메트로놈 볼륨 업데이트
    this.onCommand?.('set-metronome-volume', { volume: volume / 100 });
  }

  /**
   * 라벨 드롭다운 토글
   */
  private toggleLabelDropdown() {
    const dropdown = this.ui.querySelector('#labelDropdown') as HTMLElement;
    if (dropdown) {
      const isVisible = dropdown.style.display !== 'none';
      dropdown.style.display = isVisible ? 'none' : 'block';
    }
  }

  /**
   * 라벨 드롭다운 닫기
   */
  private closeLabelDropdown() {
    const dropdown = this.ui.querySelector('#labelDropdown') as HTMLElement;
    if (dropdown) {
      dropdown.style.display = 'none';
    }
  }

  // ========== Custom Bars Dropdown Methods ==========

  /**
   * 커스텀 Bars 드롭다운 이벤트 리스너 설정
   */
  private setupBarsDropdownListeners() {
    // 모든 커스텀 드롭다운에 이벤트 리스너 추가
    const dropdowns = this.ui.querySelectorAll('.custom-bars-dropdown');
    dropdowns.forEach(dropdown => {
      const dropdownId = dropdown.getAttribute('data-dropdown-id');
      if (!dropdownId) return;

      // 트리거 클릭 - 드롭다운 토글
      const trigger = dropdown.querySelector('.bars-dropdown-trigger');
      if (trigger) {
        trigger.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleBarsDropdown(dropdownId);
        });
      }

      // 옵션 클릭 - 값 선택
      const optionsContainer = dropdown.querySelector('.bars-options-container');
      if (optionsContainer) {
        optionsContainer.addEventListener('click', (e) => {
          const target = e.target as HTMLElement;
          if (target.classList.contains('bars-option')) {
            const value = target.getAttribute('data-value');
            if (value) {
              this.handleBarsOptionSelect(dropdown, value);
            }
          }
        });
      }

      // 스크롤 인디케이터 호버 시 자동 스크롤
      const scrollUp = dropdown.querySelector('.scroll-up');
      const scrollDown = dropdown.querySelector('.scroll-down');

      if (scrollUp) {
        scrollUp.addEventListener('mouseenter', () => {
          this.startBarsAutoScroll(dropdown, 'up');
        });
        scrollUp.addEventListener('mouseleave', () => {
          this.stopBarsAutoScroll();
        });
      }

      if (scrollDown) {
        scrollDown.addEventListener('mouseenter', () => {
          this.startBarsAutoScroll(dropdown, 'down');
        });
        scrollDown.addEventListener('mouseleave', () => {
          this.stopBarsAutoScroll();
        });
      }
    });
  }

  private barsAutoScrollInterval: number | null = null;

  /**
   * 자동 스크롤 시작
   */
  private startBarsAutoScroll(dropdown: Element, direction: 'up' | 'down') {
    this.stopBarsAutoScroll();

    const container = dropdown.querySelector('.bars-options-container') as HTMLElement;
    if (!container) return;

    const scrollStep = 3; // 스크롤 속도 (픽셀)
    const scrollInterval = 16; // 약 60fps

    this.barsAutoScrollInterval = window.setInterval(() => {
      if (direction === 'up') {
        container.scrollTop -= scrollStep;
      } else {
        container.scrollTop += scrollStep;
      }
      this.updateBarsScrollIndicators(dropdown);
    }, scrollInterval);
  }

  /**
   * 자동 스크롤 중지
   */
  private stopBarsAutoScroll() {
    if (this.barsAutoScrollInterval) {
      clearInterval(this.barsAutoScrollInterval);
      this.barsAutoScrollInterval = null;
    }
  }

  /**
   * 커스텀 Bars 드롭다운 HTML 생성
   */
  private getCustomBarsDropdownHTML(
    id: string,
    currentValue: string | number,
    type: 'duration' | 'bar-select',
    segmentId?: string
  ): string {
    // 현재 값 표시 텍스트
    let displayText = '';
    let currentBarValue: number | null = null;

    if (type === 'bar-select') {
      const bars = typeof currentValue === 'number' ? currentValue : parseInt(currentValue as string, 10);
      currentBarValue = bars;
      displayText = `${bars} bar${bars > 1 ? 's' : ''}`;
    } else {
      if (String(currentValue).startsWith('bar:')) {
        const bars = parseInt(String(currentValue).split(':')[1], 10);
        currentBarValue = bars;
        displayText = `${bars} bar${bars > 1 ? 's' : ''}`;
      } else {
        displayText = `${currentValue}s`;
      }
    }

    // 1-32 bars 옵션 생성 (초 표시 제거)
    const barsOptions = Array.from({ length: 32 }, (_, i) => {
      const bars = i + 1;
      const value = type === 'duration' ? `bar:${bars}` : String(bars);
      const label = `${bars} bar${bars > 1 ? 's' : ''}`;
      const isSelected = currentBarValue === bars;
      return `<div class="bars-option ${isSelected ? 'selected' : ''}" data-value="${value}">${label}</div>`;
    }).join('');

    // Seconds 옵션 (duration용만)
    const secondsSection = type === 'duration' ? `
      <div class="bars-section-label">Seconds</div>
      <div class="bars-option ${currentValue === '5' || currentValue === 5 ? 'selected' : ''}" data-value="5">5 seconds</div>
      <div class="bars-option ${currentValue === '10' || currentValue === 10 ? 'selected' : ''}" data-value="10">10 seconds</div>
      <div class="bars-option ${currentValue === '20' || currentValue === 20 ? 'selected' : ''}" data-value="20">20 seconds</div>
      <div class="bars-option ${currentValue === '30' || currentValue === 30 ? 'selected' : ''}" data-value="30">30 seconds</div>
      <div class="bars-option ${currentValue === '60' || currentValue === 60 ? 'selected' : ''}" data-value="60">60 seconds</div>
    ` : '';

    const dataAttrs = segmentId ? `data-segment-id="${segmentId}"` : '';

    return `
      <div class="custom-bars-dropdown" data-dropdown-id="${id}" ${dataAttrs}>
        <button class="bars-dropdown-trigger" type="button" data-value="${currentValue}">
          <span class="bars-value">${displayText}</span>
          <svg class="bars-arrow" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 10l5 5 5-5z"/>
          </svg>
        </button>
        <div class="bars-dropdown-panel" style="display: none;">
          <div class="scroll-indicator scroll-up hidden">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
              <path d="M7 14l5-5 5 5z"/>
            </svg>
          </div>
          <div class="bars-options-container">
            <div class="bars-section-label">Bars (1-32)</div>
            ${barsOptions}
            ${secondsSection}
          </div>
          <div class="scroll-indicator scroll-down">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
              <path d="M7 10l5 5 5-5z"/>
            </svg>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 커스텀 드롭다운 토글
   */
  private toggleBarsDropdown(dropdownId: string) {
    const dropdown = this.ui.querySelector(`[data-dropdown-id="${dropdownId}"]`) as HTMLElement;
    if (!dropdown) return;

    const panel = dropdown.querySelector('.bars-dropdown-panel') as HTMLElement;
    const trigger = dropdown.querySelector('.bars-dropdown-trigger') as HTMLElement;

    if (!panel || !trigger) return;

    const isOpen = panel.style.display !== 'none';

    // 다른 드롭다운 모두 닫기
    this.closeAllBarsDropdowns();

    if (!isOpen) {
      // 트리거 버튼의 위치를 기준으로 패널 위치 계산 (fixed position 사용)
      const triggerRect = trigger.getBoundingClientRect();
      panel.style.top = `${triggerRect.bottom + 2}px`;
      panel.style.left = `${triggerRect.left}px`;
      panel.style.minWidth = `${triggerRect.width}px`;

      panel.style.display = 'block';
      trigger.classList.add('open');
      this.openBarsDropdownId = dropdownId;

      // 현재 선택된 옵션으로 스크롤
      this.scrollToSelectedBarsOption(dropdown);

      // 스크롤 인디케이터 업데이트
      this.updateBarsScrollIndicators(dropdown);

      // 스크롤 이벤트 리스너 추가
      const container = dropdown.querySelector('.bars-options-container') as HTMLElement;
      if (container) {
        container.addEventListener('scroll', () => this.updateBarsScrollIndicators(dropdown));
      }
    }
  }

  /**
   * 모든 커스텀 드롭다운 닫기
   */
  private closeAllBarsDropdowns() {
    const dropdowns = this.ui.querySelectorAll('.custom-bars-dropdown');
    dropdowns.forEach(dropdown => {
      const panel = dropdown.querySelector('.bars-dropdown-panel') as HTMLElement;
      const trigger = dropdown.querySelector('.bars-dropdown-trigger') as HTMLElement;
      if (panel) panel.style.display = 'none';
      if (trigger) trigger.classList.remove('open');
    });
    this.openBarsDropdownId = null;
  }

  /**
   * 선택된 옵션으로 스크롤
   */
  private scrollToSelectedBarsOption(dropdown: Element) {
    const container = dropdown.querySelector('.bars-options-container') as HTMLElement;
    const selected = dropdown.querySelector('.bars-option.selected') as HTMLElement;

    if (container && selected) {
      // 선택된 옵션이 중앙에 오도록 스크롤
      const containerHeight = container.clientHeight;
      const selectedTop = selected.offsetTop;
      const selectedHeight = selected.offsetHeight;

      container.scrollTop = selectedTop - (containerHeight / 2) + (selectedHeight / 2);
    }
  }

  /**
   * 스크롤 인디케이터 업데이트
   */
  private updateBarsScrollIndicators(dropdown: Element) {
    const container = dropdown.querySelector('.bars-options-container') as HTMLElement;
    const upIndicator = dropdown.querySelector('.scroll-up') as HTMLElement;
    const downIndicator = dropdown.querySelector('.scroll-down') as HTMLElement;

    if (!container || !upIndicator || !downIndicator) return;

    const { scrollTop, scrollHeight, clientHeight } = container;

    // 상단 인디케이터: 위로 스크롤 가능할 때 표시
    if (scrollTop > 10) {
      upIndicator.classList.remove('hidden');
    } else {
      upIndicator.classList.add('hidden');
    }

    // 하단 인디케이터: 아래로 스크롤 가능할 때 표시
    if (scrollTop < scrollHeight - clientHeight - 10) {
      downIndicator.classList.remove('hidden');
    } else {
      downIndicator.classList.add('hidden');
    }
  }

  /**
   * 드롭다운 옵션 선택 처리
   */
  private handleBarsOptionSelect(dropdown: Element, value: string) {
    const dropdownId = dropdown.getAttribute('data-dropdown-id');
    const segmentId = dropdown.getAttribute('data-segment-id');
    const trigger = dropdown.querySelector('.bars-dropdown-trigger') as HTMLElement;

    // duration-select인 경우
    if (dropdownId === 'loopDuration') {
      if (trigger) {
        trigger.setAttribute('data-value', value);
        const valueSpan = trigger.querySelector('.bars-value') as HTMLElement;
        if (valueSpan) {
          valueSpan.textContent = this.formatBarsDropdownValue(value, 'duration');
        }
      }
    }
    // bar-select인 경우
    else if (segmentId) {
      const barValue = parseInt(value, 10);
      if (!isNaN(barValue) && barValue >= 1 && barValue <= 32) {
        if (trigger) {
          trigger.setAttribute('data-value', value);
          const valueSpan = trigger.querySelector('.bars-value') as HTMLElement;
          if (valueSpan) {
            valueSpan.textContent = this.formatBarsDropdownValue(value, 'bar-select');
          }
        }

        // End 시간 업데이트
        const segment = this.profile?.segments.find(s => s.id === segmentId);
        if (segment && this.profile?.tempo && this.profile?.timeSignature) {
          const newDuration = barsToSeconds(barValue, this.profile.tempo, this.profile.timeSignature);
          const newEndTime = segment.start + newDuration;
          this.onCommand?.('update-time', { segmentId, timeType: 'end', time: newEndTime });
        }
      }
    }

    // 선택 상태 업데이트
    const options = dropdown.querySelectorAll('.bars-option');
    options.forEach(opt => {
      opt.classList.toggle('selected', opt.getAttribute('data-value') === value);
    });

    // 드롭다운 닫기
    this.closeAllBarsDropdowns();
  }

  /**
   * 드롭다운 값 포맷팅
   */
  private formatBarsDropdownValue(value: string, type: 'duration' | 'bar-select'): string {
    if (type === 'bar-select') {
      const bars = parseInt(value, 10);
      return `${bars} bar${bars > 1 ? 's' : ''}`;
    }

    if (value.startsWith('bar:')) {
      const bars = parseInt(value.split(':')[1], 10);
      return `${bars} bar${bars > 1 ? 's' : ''}`;
    }

    return `${value}s`;
  }

  // ========== End Custom Bars Dropdown Methods ==========

  /**
   * 특정 세그먼트로 스크롤합니다.
   * 페이지 전체 스크롤은 영향받지 않고, 컴포넌트 내부 스크롤만 조정합니다.
   */
  scrollToSegment(segmentId: string) {
    const segmentsList = this.ui.querySelector('.segments-list') as HTMLElement;
    const targetCard = this.ui.querySelector(`[data-segment-id="${segmentId}"]`) as HTMLElement;

    if (segmentsList && targetCard) {
      // 컴포넌트 내부 스크롤만 조정 (scrollIntoView 대신 직접 계산)
      const listTop = segmentsList.scrollTop;
      const listHeight = segmentsList.clientHeight;
      const cardTop = targetCard.offsetTop - segmentsList.offsetTop;
      const cardHeight = targetCard.offsetHeight;

      // 카드가 보이는 영역 밖에 있는 경우에만 스크롤
      if (cardTop < listTop) {
        // 카드가 위쪽으로 벗어난 경우
        segmentsList.scrollTop = cardTop;
      } else if (cardTop + cardHeight > listTop + listHeight) {
        // 카드가 아래쪽으로 벗어난 경우
        segmentsList.scrollTop = cardTop + cardHeight - listHeight;
      }
    }
  }

  // ========== Beat Sync Modal Methods ==========

  /**
   * Beat Sync 모달을 엽니다.
   */
  private openBeatSyncModal(segmentId: string) {
    const segment = this.profile?.segments.find(s => s.id === segmentId);
    if (!segment) return;

    this.resetLocalTapSync();

    // 모달 HTML 생성 및 추가
    const modalHTML = this.getBeatSyncModalHTML(segment);
    const modalContainer = document.createElement('div');
    modalContainer.id = 'beat-sync-modal-container';
    modalContainer.innerHTML = modalHTML;

    // YouTube 테마 감지 및 적용 (html[dark] 속성 확인)
    const isDarkMode = document.documentElement.hasAttribute('dark');
    if (!isDarkMode) {
      modalContainer.classList.add('light-theme');
    }

    this.ui.appendChild(modalContainer);

    // 이벤트 리스너 설정
    this.setupBeatSyncModalEvents(segment);
  }

  /**
   * Beat Sync 모달을 닫습니다.
   */
  private closeBeatSyncModal() {
    const modalContainer = this.ui.getElementById('beat-sync-modal-container');
    if (modalContainer) {
      modalContainer.remove();
    }
    this.resetLocalTapSync();
  }

  /**
   * 로컬 TAP Sync 상태를 초기화합니다.
   */
  private resetLocalTapSync() {
    this.localTapSyncCurrentBeat = 0;
    this.localTapSyncHistory = [];
    this.localTapSyncScore = 0;
    this.localTapSyncLastResetTime = 0;
  }

  /**
   * Beat Sync 모달 HTML을 생성합니다.
   */
  private getBeatSyncModalHTML(segment: LoopSegment): string {
    const useCustom = segment.useGlobalSync === false; // 커스텀 설정 사용 여부
    const localTempo = segment.localTempo || this.profile?.tempo || 120;
    const localTimeSignature = segment.localTimeSignature || this.profile?.timeSignature || '4/4';
    const localOffset = segment.localMetronomeOffset;
    const hasLocalOffset = typeof localOffset === 'number';

    const timeSignatures = ['2/4', '3/4', '4/4', '5/4', '3/8', '6/8', '7/8', '9/8', '12/8', '6/4'];

    return `
      <div class="beat-sync-modal-overlay">
        <div class="beat-sync-modal">
          <div class="beat-sync-modal-header">
            <h3>Beat Sync - ${segment.label || 'Loop'}</h3>
            <button class="beat-sync-modal-close" id="beatSyncModalClose">&times;</button>
          </div>
          <div class="beat-sync-modal-body">
            <div class="beat-sync-global-toggle">
              <label class="checkbox-label">
                <input type="checkbox" id="useCustomSyncCheckbox" ${useCustom ? 'checked' : ''}>
                <span>Use custom settings</span>
              </label>
            </div>

            <div class="beat-sync-local-settings" id="localSettingsSection" style="${useCustom ? '' : 'opacity: 0.5; pointer-events: none;'}">
              <div class="setting-row">
                <label>BPM:</label>
                <input type="text" id="localTempoInput" class="tempo-input" value="${localTempo}" ${useCustom ? '' : 'disabled'}>
              </div>

              <div class="setting-row">
                <label>Time Signature:</label>
                <select id="localTimeSignature" ${useCustom ? '' : 'disabled'}>
                  ${timeSignatures.map(ts => `<option value="${ts}" ${ts === localTimeSignature ? 'selected' : ''}>${ts}</option>`).join('')}
                </select>
              </div>

              <div class="setting-row tap-sync-section">
                <label>Beat Sync:</label>
                <div class="tap-sync-controls-modal">
                  <div class="tap-sync-row-modal">
                    <button class="btn btn-tap-sync-modal ${this.localTapSyncCurrentBeat > 0 ? 'tapped' : ''}" id="localTapSyncBtn" ${useCustom ? '' : 'disabled'}>
                      ${this.localTapSyncCurrentBeat > 0 ? `${this.localTapSyncCurrentBeat}/${this.getBeatsPerBar(localTimeSignature)}` : 'TAP'}
                    </button>
                    <div class="sync-result-box-modal ${hasLocalOffset ? 'has-result' : ''}" id="localSyncResultBox">
                      <div class="sync-score-modal" id="localTapSyncScore">
                        <span class="score-label">Sync:</span>
                        <span class="score-value" id="localScoreValue">${this.localTapSyncHistory.length >= this.TAP_SYNC_MIN_SAMPLES ? `${this.localTapSyncScore}%` : '--%'}</span>
                      </div>
                      <div class="sync-time-modal">
                        <span class="time-value" id="localSyncResult" title="Double-click to edit">${hasLocalOffset ? this.formatSyncTime(localOffset!) : '--:---.---'}</span>
                        <input type="text" class="sync-offset-input-modal" id="localSyncOffsetInput" style="display: none;" placeholder="0:00.000" />
                        <button class="btn-sync-clear-inline" id="localSyncClear" ${useCustom && hasLocalOffset ? '' : 'style="display:none;"'} title="Clear sync">✕</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="beat-sync-modal-footer">
            <button class="btn btn-cancel" id="beatSyncModalCancel">Cancel</button>
            <button class="btn btn-save" id="beatSyncModalSave">Save</button>
          </div>
        </div>
      </div>
      <style>
        /* 테마 변수 정의 - 다크 테마 (기본값) */
        #beat-sync-modal-container {
          --modal-bg: #212121;
          --modal-bg-secondary: #181818;
          --modal-border: #3a3a3a;
          --modal-text: #fff;
          --modal-text-secondary: #aaa;
          --modal-accent: #3ea6ff;
        }
        /* 라이트 테마 */
        #beat-sync-modal-container.light-theme {
          --modal-bg: #fff;
          --modal-bg-secondary: #f2f2f2;
          --modal-border: #d3d3d3;
          --modal-text: #0f0f0f;
          --modal-text-secondary: #606060;
          --modal-accent: #065fd4;
        }
        .beat-sync-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10001;
        }
        .beat-sync-modal {
          background: var(--modal-bg);
          border-radius: 8px;
          width: 320px;
          max-width: 90vw;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
          color: var(--modal-text);
        }
        .beat-sync-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid var(--modal-border);
        }
        .beat-sync-modal-header h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
        }
        .beat-sync-modal-close {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: var(--modal-text-secondary);
          padding: 0;
          line-height: 1;
        }
        .beat-sync-modal-close:hover {
          color: var(--modal-text);
        }
        .beat-sync-modal-body {
          padding: 16px;
        }
        .beat-sync-global-toggle {
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--modal-border);
        }
        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 13px;
        }
        .checkbox-label input[type="checkbox"] {
          width: 16px;
          height: 16px;
          cursor: pointer;
        }
        .beat-sync-local-settings {
          transition: opacity 0.2s;
        }
        .setting-row {
          display: flex;
          align-items: center;
          margin-bottom: 12px;
          gap: 8px;
        }
        .setting-row label {
          min-width: 80px;
          font-size: 12px;
          color: var(--modal-text-secondary);
        }
        .setting-row .tempo-input {
          width: 60px;
          padding: 4px 8px;
          border: 1px solid var(--modal-border);
          border-radius: 4px;
          background: var(--modal-bg-secondary);
          color: var(--modal-text);
          font-size: 13px;
        }
        .setting-row select {
          padding: 4px 8px;
          border: 1px solid var(--modal-border);
          border-radius: 4px;
          background: var(--modal-bg-secondary);
          color: var(--modal-text);
          font-size: 13px;
        }
        .tap-sync-controls-modal {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .btn-tap-sync-modal {
          padding: 6px 16px;
          border: 2px solid var(--modal-accent);
          border-radius: 4px;
          background: transparent;
          color: var(--modal-accent);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.1s;
        }
        .btn-tap-sync-modal:hover:not(:disabled) {
          background: var(--modal-accent);
          color: white;
        }
        .btn-tap-sync-modal:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .btn-tap-sync-modal.tapped {
          background: var(--modal-accent);
          color: white;
          transform: scale(0.95);
        }
        .tap-sync-score-modal {
          font-size: 14px;
          font-weight: 600;
        }
        .sync-result-value {
          font-family: monospace;
          font-size: 12px;
        }
        .fine-tune-buttons {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }
        .btn-fine-tune {
          padding: 2px 6px;
          border: 1px solid var(--modal-border);
          border-radius: 3px;
          background: var(--modal-bg-secondary);
          color: var(--modal-text);
          font-size: 11px;
          cursor: pointer;
        }
        .btn-fine-tune:hover:not(:disabled) {
          background: var(--modal-border);
        }
        .btn-fine-tune:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .btn-fine-tune.btn-clear {
          color: #f44;
        }

        /* 모달용 TAP Sync 스타일 (글로벌과 동일하게 통일) */
        .tap-sync-row-modal {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .btn-tap-sync-modal {
          padding: 8px 16px;
          font-size: 13px;
          font-weight: bold;
          background: var(--modal-bg-secondary);
          border: 2px solid var(--modal-border);
          color: var(--modal-text);
          border-radius: 6px;
          cursor: pointer;
          min-width: 50px;
          text-align: center;
          transition: all 0.15s;
        }
        .btn-tap-sync-modal:hover:not(:disabled) {
          background: var(--modal-border);
        }
        .btn-tap-sync-modal.tapped {
          background: var(--modal-accent);
          border-color: var(--modal-accent);
          color: white;
        }
        .btn-tap-sync-modal:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .sync-result-box-modal {
          display: flex;
          flex-direction: column;
          padding: 6px 10px;
          border-radius: 6px;
          background: var(--modal-bg-secondary);
          border: 1px solid var(--modal-border);
          min-width: 100px;
        }
        .sync-result-box-modal.has-result {
          border-color: var(--modal-accent);
        }
        .sync-score-modal {
          display: flex;
          gap: 4px;
          font-size: 11px;
          color: var(--modal-text-secondary);
        }
        .sync-score-modal .score-value {
          font-weight: bold;
        }
        .sync-time-modal {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .sync-time-modal .time-value {
          font-family: 'Courier New', monospace;
          font-size: 13px;
          color: var(--modal-text);
          cursor: pointer;
        }
        .sync-time-modal .time-value:hover {
          text-decoration: underline;
        }
        .sync-offset-input-modal {
          font-family: 'Courier New', monospace;
          font-size: 13px;
          color: var(--modal-text);
          background: var(--modal-bg-secondary);
          border: 1px solid var(--modal-accent);
          border-radius: 4px;
          padding: 2px 6px;
          width: 80px;
          outline: none;
        }
        .btn-sync-clear-inline {
          background: none;
          border: none;
          color: #f44;
          cursor: pointer;
          padding: 0 4px;
          font-size: 12px;
          opacity: 0.7;
        }
        .btn-sync-clear-inline:hover {
          opacity: 1;
        }

        .beat-sync-modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding: 12px 16px;
          border-top: 1px solid var(--modal-border);
        }
        .btn-cancel {
          padding: 6px 16px;
          border: 1px solid var(--modal-border);
          border-radius: 4px;
          background: transparent;
          color: var(--modal-text);
          cursor: pointer;
        }
        .btn-cancel:hover {
          background: var(--modal-bg-secondary);
        }
        .btn-save {
          padding: 6px 16px;
          border: none;
          border-radius: 4px;
          background: var(--modal-accent);
          color: white;
          cursor: pointer;
          font-weight: 500;
        }
        .btn-save:hover {
          opacity: 0.9;
        }
      </style>
    `;
  }

  /**
   * Beat Sync 모달 이벤트 리스너를 설정합니다.
   */
  private setupBeatSyncModalEvents(segment: LoopSegment) {
    const modalContainer = this.ui.getElementById('beat-sync-modal-container');
    if (!modalContainer) return;

    // 닫기 버튼
    const closeBtn = modalContainer.querySelector('#beatSyncModalClose');
    closeBtn?.addEventListener('click', () => this.closeBeatSyncModal());

    // 취소 버튼
    const cancelBtn = modalContainer.querySelector('#beatSyncModalCancel');
    cancelBtn?.addEventListener('click', () => this.closeBeatSyncModal());

    // 오버레이 클릭으로 닫기
    const overlay = modalContainer.querySelector('.beat-sync-modal-overlay');
    overlay?.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.closeBeatSyncModal();
      }
    });

    // Use custom settings 체크박스
    const useCustomCheckbox = modalContainer.querySelector('#useCustomSyncCheckbox') as HTMLInputElement;
    const localSettingsSection = modalContainer.querySelector('#localSettingsSection') as HTMLElement;

    useCustomCheckbox?.addEventListener('change', () => {
      const useCustom = useCustomCheckbox.checked;
      if (localSettingsSection) {
        localSettingsSection.style.opacity = useCustom ? '1' : '0.5';
        localSettingsSection.style.pointerEvents = useCustom ? 'auto' : 'none';
      }

      // 모든 입력 필드 disabled 상태 변경
      const inputs = localSettingsSection?.querySelectorAll('input, select, button');
      inputs?.forEach(input => {
        (input as HTMLInputElement | HTMLSelectElement | HTMLButtonElement).disabled = !useCustom;
      });
    });

    // TAP Sync 버튼
    const tapBtn = modalContainer.querySelector('#localTapSyncBtn') as HTMLButtonElement;
    tapBtn?.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (tapBtn.disabled) return;
      this.handleLocalTapSync(modalContainer);
    });

    // 미세 조정 버튼
    const adjustOffset = (delta: number) => {
      const resultSpan = modalContainer.querySelector('#localSyncResult') as HTMLElement;
      if (!resultSpan) return;

      const currentOffset = this.parseTimeToSeconds(resultSpan.textContent || '0');
      const newOffset = Math.max(0, currentOffset + delta / 1000);
      resultSpan.textContent = this.formatSyncTime(newOffset);
    };

    modalContainer.querySelector('#localSyncMinus10')?.addEventListener('click', () => adjustOffset(-10));
    modalContainer.querySelector('#localSyncMinus1')?.addEventListener('click', () => adjustOffset(-1));
    modalContainer.querySelector('#localSyncPlus1')?.addEventListener('click', () => adjustOffset(1));
    modalContainer.querySelector('#localSyncPlus10')?.addEventListener('click', () => adjustOffset(10));

    // Clear 버튼
    modalContainer.querySelector('#localSyncClear')?.addEventListener('click', () => {
      const resultRow = modalContainer.querySelector('#localSyncResultRow') as HTMLElement;
      const resultSpan = modalContainer.querySelector('#localSyncResult') as HTMLElement;
      if (resultRow) resultRow.style.display = 'none';
      if (resultSpan) resultSpan.textContent = '--';
      this.resetLocalTapSync();
      this.updateLocalTapSyncUI(modalContainer);
    });

    // 오프셋 더블클릭 편집
    const localSyncResult = modalContainer.querySelector('#localSyncResult') as HTMLElement;
    const localSyncOffsetInput = modalContainer.querySelector('#localSyncOffsetInput') as HTMLInputElement;
    if (localSyncResult && localSyncOffsetInput) {
      localSyncResult.addEventListener('dblclick', () => {
        // Use custom settings가 활성화되어 있을 때만 편집 가능
        const useCustomCheckbox = modalContainer.querySelector('#useCustomSyncCheckbox') as HTMLInputElement;
        if (!useCustomCheckbox?.checked) return;

        const currentText = localSyncResult.textContent || '';
        const currentOffset = this.parseTimeToSeconds(currentText);
        localSyncOffsetInput.value = this.formatTime(currentOffset);
        localSyncResult.style.display = 'none';
        localSyncOffsetInput.style.display = 'block';
        localSyncOffsetInput.focus();
        localSyncOffsetInput.select();
      });

      localSyncOffsetInput.addEventListener('blur', () => {
        this.handleLocalOffsetInputConfirm(localSyncResult, localSyncOffsetInput, modalContainer);
      });

      localSyncOffsetInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleLocalOffsetInputConfirm(localSyncResult, localSyncOffsetInput, modalContainer);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          localSyncResult.style.display = '';
          localSyncOffsetInput.style.display = 'none';
        }
      });
    }

    // 저장 버튼
    const saveBtn = modalContainer.querySelector('#beatSyncModalSave');
    saveBtn?.addEventListener('click', () => {
      this.saveBeatSyncSettings(modalContainer, segment.id);
    });
  }

  /**
   * 로컬 TAP Sync를 처리합니다.
   */
  private handleLocalTapSync(modalContainer: HTMLElement) {
    const tempoInput = modalContainer.querySelector('#localTempoInput') as HTMLInputElement;
    const timeSignatureSelect = modalContainer.querySelector('#localTimeSignature') as HTMLSelectElement;

    const bpm = parseInt(tempoInput?.value || '120', 10);
    const timeSignature = timeSignatureSelect?.value || '4/4';
    const beatsPerBar = parseInt(timeSignature.split('/')[0], 10);
    const beatDuration = 60 / bpm;

    // 현재 박자 증가
    this.localTapSyncCurrentBeat = (this.localTapSyncCurrentBeat % beatsPerBar) + 1;

    // 소리 피드백
    const isDownbeat = this.localTapSyncCurrentBeat === 1;
    this.tapSyncMetronome.playClickNow(isDownbeat);

    // TAP 버튼 시각적 피드백
    const tapBtn = modalContainer.querySelector('#localTapSyncBtn') as HTMLButtonElement;
    if (tapBtn) {
      tapBtn.textContent = `${this.localTapSyncCurrentBeat}/${beatsPerBar}`;
      tapBtn.classList.add('tapped');
      setTimeout(() => tapBtn.classList.remove('tapped'), 100);
    }

    // 5초 이상 탭이 없으면 히스토리 리셋
    const now = Date.now();
    if (now - this.localTapSyncLastResetTime > 5000 && this.localTapSyncHistory.length > 0) {
      this.localTapSyncHistory = [];
      this.localTapSyncScore = 0;
    }
    this.localTapSyncLastResetTime = now;

    // 현재 탭 기록
    this.onCommand?.('get-current-time', {
      callback: (currentTime: number) => {
        const beatsFromDownbeat = this.localTapSyncCurrentBeat - 1;
        const estimatedDownbeatTime = currentTime - (beatsFromDownbeat * beatDuration);

        const barDuration = beatDuration * beatsPerBar;
        let calculatedOffset = estimatedDownbeatTime % barDuration;
        if (calculatedOffset < 0) calculatedOffset += barDuration;

        this.localTapSyncHistory.push({
          beatNumber: this.localTapSyncCurrentBeat,
          tappedTime: currentTime,
          calculatedOffset
        });

        if (this.localTapSyncHistory.length > 16) {
          this.localTapSyncHistory.shift();
        }

        // 결과 계산 및 UI 업데이트
        if (this.localTapSyncHistory.length >= 2) {
          const { averageOffset, score } = this.calculateLocalTapSyncResult(barDuration);
          this.localTapSyncScore = score;

          // 1st Beat 표시 업데이트
          const resultRow = modalContainer.querySelector('#localSyncResultRow') as HTMLElement;
          const resultSpan = modalContainer.querySelector('#localSyncResult') as HTMLElement;
          if (resultRow) resultRow.style.display = 'flex';
          if (resultSpan) resultSpan.textContent = this.formatSyncTime(averageOffset);
        }

        this.updateLocalTapSyncUI(modalContainer);
      }
    });
  }

  /**
   * 로컬 TAP Sync 결과를 계산합니다.
   */
  private calculateLocalTapSyncResult(barDuration: number): { averageOffset: number; score: number } {
    if (this.localTapSyncHistory.length < 2) {
      return { averageOffset: 0, score: 0 };
    }

    const offsets = this.localTapSyncHistory.map(t => t.calculatedOffset);

    // 원형 평균 계산
    let sinSum = 0;
    let cosSum = 0;
    for (const offset of offsets) {
      const angle = (offset / barDuration) * 2 * Math.PI;
      sinSum += Math.sin(angle);
      cosSum += Math.cos(angle);
    }
    const avgAngle = Math.atan2(sinSum / offsets.length, cosSum / offsets.length);
    let averageOffset = (avgAngle / (2 * Math.PI)) * barDuration;
    if (averageOffset < 0) averageOffset += barDuration;

    // 표준편차 계산
    let varianceSum = 0;
    for (const offset of offsets) {
      let diff = Math.abs(offset - averageOffset);
      if (diff > barDuration / 2) diff = barDuration - diff;
      varianceSum += diff * diff;
    }
    const stdDev = Math.sqrt(varianceSum / offsets.length);
    const stdDevMs = stdDev * 1000;

    // 점수 계산
    let consistencyScore: number;
    if (stdDevMs <= 15) {
      consistencyScore = 90 + (1 - stdDevMs / 15) * 10;
    } else if (stdDevMs <= 25) {
      consistencyScore = 80 + (1 - (stdDevMs - 15) / 10) * 10;
    } else if (stdDevMs <= 40) {
      consistencyScore = 50 + (1 - (stdDevMs - 25) / 15) * 30;
    } else if (stdDevMs <= 60) {
      consistencyScore = (1 - (stdDevMs - 40) / 20) * 50;
    } else {
      consistencyScore = 0;
    }

    // 템포 정확도 계산
    let tempoScore = 100;
    if (this.localTapSyncHistory.length >= 3) {
      const tappedTimes = this.localTapSyncHistory.map(t => t.tappedTime);
      const intervals: number[] = [];
      for (let i = 1; i < tappedTimes.length; i++) {
        intervals.push(tappedTimes[i] - tappedTimes[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const tempoInput = this.ui.querySelector('#localTempoInput') as HTMLInputElement;
      const bpm = parseInt(tempoInput?.value || '120', 10);
      const expectedBeatDuration = 60 / bpm;
      const tempoErrorPercent = Math.abs(avgInterval - expectedBeatDuration) / expectedBeatDuration * 100;

      if (tempoErrorPercent <= 2) {
        tempoScore = 100;
      } else if (tempoErrorPercent <= 5) {
        tempoScore = 80 + (1 - (tempoErrorPercent - 2) / 3) * 20;
      } else if (tempoErrorPercent <= 10) {
        tempoScore = 50 + (1 - (tempoErrorPercent - 5) / 5) * 30;
      } else if (tempoErrorPercent <= 15) {
        tempoScore = 20 + (1 - (tempoErrorPercent - 10) / 5) * 30;
      } else {
        tempoScore = Math.max(0, 20 - (tempoErrorPercent - 15) * 2);
      }
    }

    const finalScore = consistencyScore * 0.7 + tempoScore * 0.3;
    return { averageOffset, score: Math.round(finalScore) };
  }

  /**
   * 로컬 TAP Sync UI를 업데이트합니다.
   */
  private updateLocalTapSyncUI(modalContainer: HTMLElement) {
    const scoreDiv = modalContainer.querySelector('#localTapSyncScore') as HTMLElement;
    if (!scoreDiv) return;

    const tapCount = this.localTapSyncHistory.length;
    const hasEnoughSamples = tapCount >= this.TAP_SYNC_MIN_SAMPLES;

    if (tapCount > 0) {
      scoreDiv.style.display = 'block';
      const scoreColor = hasEnoughSamples ? this.getScoreColor(this.localTapSyncScore) : '#f44336';
      scoreDiv.style.color = scoreColor;
      scoreDiv.textContent = hasEnoughSamples ? `${this.localTapSyncScore}%` : '--%';
      scoreDiv.title = `Sync accuracy (${tapCount}/${this.TAP_SYNC_MIN_SAMPLES} taps)`;
    } else {
      scoreDiv.style.display = 'none';
    }
  }

  /**
   * 시간 문자열을 초로 변환합니다.
   */
  private parseTimeToSeconds(timeStr: string): number {
    if (timeStr === '--') return 0;
    const parts = timeStr.split(':');
    if (parts.length === 2) {
      const mins = parseInt(parts[0], 10);
      const secs = parseFloat(parts[1]);
      return mins * 60 + secs;
    }
    return parseFloat(timeStr) || 0;
  }

  /**
   * 로컬 오프셋 입력 확인 핸들러 (커스텀 Beat Sync 모달용)
   */
  private handleLocalOffsetInputConfirm(
    display: HTMLElement,
    input: HTMLInputElement,
    modalContainer: HTMLElement
  ) {
    const value = this.parseTimeInput(input.value);

    if (value !== null && value >= 0) {
      // 디스플레이 업데이트
      display.textContent = this.formatSyncTime(value);

      // 직접 입력 시 TAP Sync 점수 리셋
      this.localTapSyncHistory = [];
      this.localTapSyncScore = 0;
      this.updateLocalTapSyncUI(modalContainer);

      // Clear 버튼 표시
      const clearBtn = modalContainer.querySelector('#localSyncClear') as HTMLElement;
      if (clearBtn) clearBtn.style.display = '';

      // sync-result-box에 has-result 클래스 추가
      const resultBox = modalContainer.querySelector('#localSyncResultBox');
      if (resultBox) resultBox.classList.add('has-result');
    }

    display.style.display = '';
    input.style.display = 'none';
  }

  /**
   * Beat Sync 설정을 저장합니다.
   */
  private saveBeatSyncSettings(modalContainer: HTMLElement, segmentId: string) {
    const useCustomCheckbox = modalContainer.querySelector('#useCustomSyncCheckbox') as HTMLInputElement;
    const tempoInput = modalContainer.querySelector('#localTempoInput') as HTMLInputElement;
    const timeSignatureSelect = modalContainer.querySelector('#localTimeSignature') as HTMLSelectElement;
    const resultSpan = modalContainer.querySelector('#localSyncResult') as HTMLElement;

    const useCustom = useCustomCheckbox?.checked ?? false;
    const localTempo = parseInt(tempoInput?.value || '120', 10);
    const localTimeSignature = timeSignatureSelect?.value || '4/4';
    const resultText = resultSpan?.textContent || '--';
    const localOffset = resultText !== '--' ? this.parseTimeToSeconds(resultText) : undefined;

    this.onCommand?.('update-segment-sync', {
      segmentId,
      useGlobalSync: !useCustom,  // 반전: useCustom이 true면 useGlobalSync는 false
      localTempo: useCustom ? localTempo : undefined,
      localTimeSignature: useCustom ? localTimeSignature : undefined,
      localMetronomeOffset: useCustom ? localOffset : undefined
    });

    this.closeBeatSyncModal();
  }

  // ========== End Beat Sync Modal Methods ==========

  // ========== Count-In Methods ==========

  /**
   * 카운트인/메트로놈 비트 표시를 업데이트합니다.
   * @param currentBeat 현재 박 (1-indexed)
   * @param totalBeats 총 박 수
   * @param mode 표시 모드 ('count-in' = 보라색, 'metronome' = 우드톤)
   */
  showCountInBeat(currentBeat: number, totalBeats: number, mode: 'count-in' | 'metronome' = 'count-in'): void {
    const display = this.ui.querySelector('#countInDisplay') as HTMLElement;
    if (!display) return;

    // 모드에 따라 클래스 설정
    if (mode === 'metronome') {
      display.classList.add('metronome-mode');
    } else {
      display.classList.remove('metronome-mode');
    }

    // 박자표에 맞게 beat 요소 업데이트
    display.innerHTML = '';
    for (let i = 1; i <= totalBeats; i++) {
      const beatElement = document.createElement('span');
      beatElement.className = `count-beat${i === currentBeat ? ' active' : ''}`;
      beatElement.dataset.beat = String(i);
      beatElement.textContent = String(i);
      display.appendChild(beatElement);
    }
  }

  /**
   * 카운트인/메트로놈 표시를 숨깁니다 (비트 하이라이트만 제거).
   */
  hideCountInDisplay(): void {
    const display = this.ui.querySelector('#countInDisplay') as HTMLElement;
    if (!display) return;

    display.classList.remove('metronome-mode');

    // 현재 박자표에 맞게 리셋 (active 클래스 제거)
    const beatsPerBar = this.profile?.timeSignature
      ? parseInt(this.profile.timeSignature.split('/')[0], 10)
      : 4;

    display.innerHTML = Array.from({ length: beatsPerBar }, (_, i) =>
      `<span class="count-beat" data-beat="${i + 1}">${i + 1}</span>`
    ).join('');
  }

  // ========== End Count-In Methods ==========

  /**
   * UI를 정리합니다.
   */
  cleanup() {
    // TAP Sync 메트로놈 정리
    this.tapSyncMetronome.dispose();

    // 글로벌 메트로놈 상태 초기화
    this.isGlobalMetronomeEnabled = false;

    this.ui.remove();
  }
}
