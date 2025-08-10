// Popup script for YouTube Loop & Practice Extension

interface VideoProfile {
  videoId: string;
  defaultRate: number;
  segments: LoopSegment[];
  activeSegmentId: string | null;
  bpm: number | null;
  countInBeats: number;
  metronomeEnabled: boolean;
  schemaVersion: number;
}

interface LoopSegment {
  id: string;
  start: number;
  end: number;
  rate: number;
  label: string;
}

export class PopupController {
  private tab?: chrome.tabs.Tab;
  private profile?: VideoProfile;

  async init() {
    try {
      console.log('팝업 초기화 시작');
      
      // 현재 활성 탭 정보 가져오기
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab?.url) {
        console.log('탭 URL이 없음');
        this.updateStatus('YouTube 페이지가 아닙니다', '0개', '설정 안됨');
        return;
      }
      
      console.log('탭 정보:', { id: tab.id, url: tab.url });
      this.tab = tab;
      
      // YouTube watch 페이지인지 확인
      const isYouTubeWatch = tab.url.includes('youtube.com/watch') || tab.url.includes('youtu.be/');
      
      if (!isYouTubeWatch) {
        console.log('YouTube watch 페이지가 아님:', tab.url);
        this.updateStatus('YouTube watch 페이지가 아닙니다', '0개', '설정 안됨');
        return;
      }
      
      // 비디오 ID 추출
      const videoId = this.extractVideoId(tab.url);
      if (!videoId) {
        console.log('비디오 ID 추출 실패:', tab.url);
        this.updateStatus('비디오 ID를 찾을 수 없습니다', '0개', '설정 안됨');
        return;
      }
      
      console.log('비디오 ID:', videoId);
      
      // 저장된 프로필 정보 가져오기
      this.profile = await this.loadProfile(videoId);
      
      this.updateStatus(
        'YouTube watch 페이지',
        `${this.profile?.segments.length || 0}개`,
        this.profile?.bpm ? `${this.profile.bpm} BPM` : '설정 안됨'
      );
      
      // UI 초기화
      this.initializeUI();
      this.setupEventListeners();
      this.updateSegmentsList();
      
      console.log('팝업 초기화 완료');
      
    } catch (error) {
      console.error('팝업 초기화 실패:', error);
      this.updateStatus('오류 발생', '0개', '설정 안됨');
    }
  }

  private updateStatus(page: string, segments: string, bpm: string) {
    const currentPageEl = document.getElementById('currentPage');
    const segmentCountEl = document.getElementById('segmentCount');
    const bpmEl = document.getElementById('bpm');
    
    if (currentPageEl) currentPageEl.textContent = page;
    if (segmentCountEl) segmentCountEl.textContent = segments;
    if (bpmEl) bpmEl.textContent = bpm;
  }

  private extractVideoId(url: string): string | null {
    try {
      const u = new URL(url);
      if (u.hostname === 'youtu.be') {
        return u.pathname.slice(1) || null;
      }
      if (u.hostname.includes('youtube.com')) {
        return u.searchParams.get('v');
      }
      return null;
    } catch {
      return null;
    }
  }

  private async loadProfile(videoId: string): Promise<VideoProfile> {
    try {
      const key = `vid:${videoId}`;
      const data = await chrome.storage.sync.get(key);
      return data[key] || { 
        videoId, 
        defaultRate: 1.0, 
        segments: [], 
        activeSegmentId: null, 
        bpm: null, 
        countInBeats: 4, 
        metronomeEnabled: false, 
        schemaVersion: 1 
      };
    } catch {
      return { 
        videoId, 
        defaultRate: 1.0, 
        segments: [], 
        activeSegmentId: null, 
        bpm: null, 
        countInBeats: 4, 
        metronomeEnabled: false, 
        schemaVersion: 1 
      };
    }
  }

  private initializeUI() {
    if (!this.profile) return;
    
    const currentRateEl = document.getElementById('currentRate');
    if (currentRateEl) {
      // defaultRate 안전성 검사 추가
      const safeDefaultRate = typeof this.profile.defaultRate === 'number' && !isNaN(this.profile.defaultRate) 
        ? this.profile.defaultRate 
        : 1.0;
      currentRateEl.textContent = `${safeDefaultRate.toFixed(2)}x`;
    }
    
    const bpmInputEl = document.getElementById('bpmInput') as HTMLInputElement;
    if (bpmInputEl && this.profile.bpm) {
      bpmInputEl.value = this.profile.bpm.toString();
    }
  }

  private setupEventListeners() {
    // 재생/일시정지
    const togglePlayBtn = document.getElementById('togglePlay');
    if (togglePlayBtn) {
      togglePlayBtn.addEventListener('click', () => this.sendCommand('toggle-play'));
    }
    
    // 루프 토글
    const toggleLoopBtn = document.getElementById('toggleLoop');
    if (toggleLoopBtn) {
      toggleLoopBtn.addEventListener('click', () => this.sendCommand('toggle-loop'));
    }
    
    // 재생 속도 조절
    const decreaseRateBtn = document.getElementById('decreaseRate');
    const increaseRateBtn = document.getElementById('increaseRate');
    if (decreaseRateBtn) {
      decreaseRateBtn.addEventListener('click', () => this.sendCommand('decrease-speed'));
    }
    if (increaseRateBtn) {
      increaseRateBtn.addEventListener('click', () => this.sendCommand('increase-speed'));
    }
    
    // 구간 이동
    const prevSegmentBtn = document.getElementById('prevSegment');
    const nextSegmentBtn = document.getElementById('nextSegment');
    if (prevSegmentBtn) {
      prevSegmentBtn.addEventListener('click', () => this.sendCommand('prev-segment'));
    }
    if (nextSegmentBtn) {
      nextSegmentBtn.addEventListener('click', () => this.sendCommand('next-segment'));
    }
    
    // BPM 설정
    const setBpmBtn = document.getElementById('setBpm');
    if (setBpmBtn) {
      setBpmBtn.addEventListener('click', () => this.setBpm());
    }
    
    // 탭 템포
    const tapTempoBtn = document.getElementById('tapTempo');
    if (tapTempoBtn) {
      tapTempoBtn.addEventListener('click', () => this.sendCommand('tap-tempo'));
    }
    
    // 메트로놈 토글
    const toggleMetronomeBtn = document.getElementById('toggleMetronome');
    if (toggleMetronomeBtn) {
      toggleMetronomeBtn.addEventListener('click', () => this.sendCommand('toggle-metronome'));
    }
    
    // 구간 생성
    const createSegmentBtn = document.getElementById('createSegment');
    if (createSegmentBtn) {
      createSegmentBtn.addEventListener('click', () => this.createSegment());
    }
    
    // 구간 끝점 설정
    const setSegmentEndBtn = document.getElementById('setSegmentEnd');
    if (setSegmentEndBtn) {
      setSegmentEndBtn.addEventListener('click', () => this.sendCommand('set-segment-end'));
    }
  }

  private async ensureContentScriptReady() {
    if (!this.tab?.id) {
      console.error("탭 정보가 없습니다");
      return false;
    }

    // 빠른 연결 확인 (최대 3번 시도, 각각 100ms, 200ms, 400ms)
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`Content Script 연결 확인 시도 ${attempt}/3`);
        const response = await chrome.tabs.sendMessage(this.tab.id, { type: "PING" });
        
        if (response && response.status === "ok") {
          console.log("Content Script 연결 성공", response);
          
          // 초기화 상태 확인
          if (response.initialized === false) {
            console.log("Content Script가 아직 초기화되지 않음, 대기 중...");
            // 초기화를 기다림
            await new Promise(resolve => setTimeout(resolve, 500));
            continue;
          }
          
          return true;
        }
        console.log("Content Script 응답이 올바르지 않음:", response);
      } catch (error) {
        console.log(`Content Script 연결 실패 (시도 ${attempt}/3):`, error);
        if (attempt < 3) {
          const delay = 100 * Math.pow(2, attempt - 1); // 100ms, 200ms, 400ms
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    console.error("Content Script 연결 실패 - 모든 시도 실패");
    return false;
  }

  private async sendMessageToContentScript(message: any): Promise<any> {
    if (!this.tab?.id) {
      throw new Error('탭 정보가 없습니다');
    }

    try {
      // Content Script 연결 확인
      if (!await this.ensureContentScriptReady()) {
        throw new Error('Content script가 응답하지 않습니다');
      }

      // 메시지 전송
      const response = await chrome.tabs.sendMessage(this.tab.id, message);
      
      if (response && response.error) {
        throw new Error(response.error);
      }
      
      return response;
    } catch (error) {
      console.error('메시지 전송 실패:', error);
      throw error;
    }
  }

  private async sendCommand(command: string) {
    try {
      await this.sendMessageToContentScript({ type: 'COMMAND', command });
      setTimeout(() => this.refreshState(), 100);
    } catch (error) {
      console.error('명령어 전송 실패:', error);
      const errorMessage = error instanceof Error && error.message.includes('Receiving end does not exist') 
        ? 'YouTube 페이지를 새로고침한 후 다시 시도해주세요.'
        : '명령어 실행에 실패했습니다.';
      this.showError(errorMessage);
    }
  }

  private async setBpm() {
    const bpmInput = document.getElementById('bpmInput') as HTMLInputElement;
    if (!bpmInput || !this.tab?.id) return;

    const bpm = parseInt(bpmInput.value);
    if (bpm >= 60 && bpm <= 200) {
      try {
        await this.sendMessageToContentScript({ type: 'SET_BPM', bpm });
        setTimeout(() => this.refreshState(), 100);
      } catch (error) {
        console.error('BPM 설정 실패:', error);
      }
    }
  }

  private async createSegment() {
    const segmentLabelInput = document.getElementById('segmentLabel') as HTMLInputElement;
    if (!segmentLabelInput || !this.tab?.id) return;

    let label = segmentLabelInput.value;
    if (!label) {
      try {
        const response = await this.sendMessageToContentScript({ type: 'GET_CURRENT_TIME' });
        if (response?.currentTime !== undefined) {
          label = this.formatTime(response.currentTime);
        } else {
          label = `구간 ${this.profile?.segments.length ? this.profile.segments.length + 1 : 1}`;
        }
      } catch (error) {
        console.error('현재 시간 가져오기 실패:', error);
        label = `구간 ${this.profile?.segments.length ? this.profile.segments.length + 1 : 1}`;
      }
    }

    try {
      await this.sendMessageToContentScript({ type: 'CREATE_SEGMENT', label });
      segmentLabelInput.value = '';
      setTimeout(() => this.refreshState(), 100);
    } catch (error) {
      console.error('구간 생성 실패:', error);
    }
  }

  private async refreshState() {
    if (!this.tab?.id) return;

    try {
      const response = await this.sendMessageToContentScript({ type: 'GET_STATE' });
      if (response?.profile) {
        this.profile = response.profile;
        this.updateStatus(
          'YouTube watch 페이지',
          `${this.profile?.segments.length || 0}개`,
          this.profile?.bpm ? `${this.profile.bpm} BPM` : '설정 안됨'
        );
        this.initializeUI();
        this.updateSegmentsList();
      }
    } catch (error) {
      console.error('상태 새로고침 실패:', error);
    }
  }

  // 구간 상태 변경 후 즉시 UI 업데이트
  private updateSegmentState(segmentId: string, isActive: boolean) {
    if (!this.profile) return;
    
    // 프로필 상태 업데이트
    this.profile.activeSegmentId = isActive ? segmentId : null;
    
    // UI 즉시 업데이트
    this.updateSegmentsList();
  }

  private updateSegmentsList() {
    if (!this.profile) return;
    
    const segmentsListEl = document.getElementById('segmentsList');
    if (!segmentsListEl) return;
    
    segmentsListEl.innerHTML = '';
    
    this.profile.segments.forEach(segment => {
      // 데이터 유효성 검사
      const safeLabel = segment.label || '구간';
      const safeStart = typeof segment.start === 'number' && !isNaN(segment.start) ? segment.start : 0;
      const safeEnd = typeof segment.end === 'number' && !isNaN(segment.end) ? segment.end : 10;
      const safeRate = typeof segment.rate === 'number' && !isNaN(segment.rate) ? segment.rate : 1.0;
      
      const segmentItem = document.createElement('div');
      segmentItem.className = `segment-item ${segment.id === this.profile?.activeSegmentId ? 'active' : ''}`;
      
      // data-segment-id 속성을 segment-item에 직접 추가
      segmentItem.setAttribute('data-segment-id', segment.id);
      
      segmentItem.innerHTML = `
        <div class="segment-info">
          <div class="segment-label">
            <span class="label-text">${safeLabel}</span>
            <button class="label-edit-btn" data-segment-id="${segment.id}" data-action="edit-label">✏️</button>
          </div>
          <div class="segment-time">
            <div class="time-input-group">
              <span>시작:</span>
              <input type="text" class="time-input" data-segment-id="${segment.id}" data-time-type="start" 
                     value="${this.formatTime(safeStart)}" placeholder="0:00">
              <button class="time-set-btn" data-segment-id="${segment.id}" data-action="set-start-time">현재</button>
            </div>
            <div class="time-input-group">
              <span>종료:</span>
              <input type="text" class="time-input" data-segment-id="${segment.id}" data-time-type="end" 
                     value="${this.formatTime(safeEnd)}" placeholder="0:00">
              <button class="time-set-btn" data-segment-id="${segment.id}" data-action="set-end-time">현재</button>
            </div>
          </div>
          <div class="rate-control-group">
            <span>속도:</span>
            <div class="rate-input-container">
              <button class="rate-btn" data-segment-id="${segment.id}" data-action="decrease-rate">-</button>
              <input type="number" class="rate-input" data-segment-id="${segment.id}" 
                     value="${Math.round(safeRate * 100)}" min="5" max="160" step="5">
              <span class="rate-unit">%</span>
              <button class="rate-btn" data-segment-id="${segment.id}" data-action="increase-rate">+</button>
            </div>
          </div>
        </div>
        <div class="segment-actions">
          <button class="btn btn-small ${segment.id === this.profile?.activeSegmentId ? 'btn-primary' : ''}" data-segment-id="${segment.id}" data-action="activate">${segment.id === this.profile?.activeSegmentId ? '비활성화' : '활성화'}</button>
          <button class="btn btn-small btn-edit" data-segment-id="${segment.id}" data-action="edit-segment">편집</button>
          <button class="btn btn-small btn-danger" data-segment-id="${segment.id}" data-action="delete">삭제</button>
        </div>
      `;
      
      segmentsListEl.appendChild(segmentItem);
    });
    
    if (this.profile.segments.length === 0) {
      segmentsListEl.innerHTML = '<div style="text-align: center; color: #6c757d; padding: 20px;">구간이 없습니다</div>';
    }
    
    // 이벤트 리스너 추가
    this.setupSegmentEventListeners();
  }

  private formatTime(seconds: number): string {
    // 안전성 검사 추가
    if (typeof seconds !== 'number' || isNaN(seconds)) {
      return '0:00';
    }
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  private showError(message: string) {
    // 에러 메시지를 표시할 요소 생성
    const errorEl = document.createElement('div');
    errorEl.className = 'error-message';
    errorEl.textContent = message;
    errorEl.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: #dc3545;
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 1000;
      max-width: 300px;
      text-align: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;
    
    document.body.appendChild(errorEl);
    
    // 5초 후 자동 제거 (더 긴 시간)
    setTimeout(() => {
      if (errorEl.parentNode) {
        errorEl.parentNode.removeChild(errorEl);
      }
    }, 5000);
  }

  private showSuccess(message: string) {
    // 성공 메시지를 표시할 요소 생성
    const successEl = document.createElement('div');
    successEl.className = 'success-message';
    successEl.textContent = message;
    successEl.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: #28a745;
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 1000;
      max-width: 300px;
      text-align: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;
    
    document.body.appendChild(successEl);
    
    // 3초 후 자동 제거
    setTimeout(() => {
      if (successEl.parentNode) {
        successEl.parentNode.removeChild(successEl);
      }
    }, 3000);
  }

  private setupSegmentEventListeners() {
    const segmentsListEl = document.getElementById('segmentsList');
    if (!segmentsListEl) return;
    
    // 기존 이벤트 리스너 제거 (중복 방지)
    segmentsListEl.removeEventListener('click', this.handleSegmentClick);
    segmentsListEl.removeEventListener('input', this.handleInputChange);
    segmentsListEl.removeEventListener('change', this.handleInputChange);
    segmentsListEl.removeEventListener('blur', this.handleInputBlur);
    segmentsListEl.removeEventListener('keydown', this.handleInputKeydown);
    
    // 새로운 이벤트 리스너 등록
    segmentsListEl.addEventListener('click', this.handleSegmentClick);
    segmentsListEl.addEventListener('input', this.handleInputChange);
    segmentsListEl.addEventListener('change', this.handleInputChange);
    segmentsListEl.addEventListener('blur', this.handleInputBlur);
    segmentsListEl.addEventListener('keydown', this.handleInputKeydown);
  }

  private handleSegmentClick = (e: Event) => {
    const target = e.target as HTMLElement;
    
    if (target.tagName === 'BUTTON') {
      const segmentId = target.getAttribute('data-segment-id');
      const action = target.getAttribute('data-action');
      
      if (segmentId && action) {
        if (action === 'activate') {
          this.activateSegment(segmentId);
        } else if (action === 'delete') {
          this.deleteSegment(segmentId);
        } else if (action === 'edit-label') {
          this.editSegmentLabel(segmentId);
        } else if (action === 'set-start-time') {
          this.setSegmentStartTime(segmentId);
        } else if (action === 'set-end-time') {
          this.setSegmentEndTime(segmentId);
        } else if (action === 'edit-segment') {
          this.editSegment(segmentId);
        } else if (action === 'decrease-rate') {
          this.decreaseSegmentRate(segmentId);
        } else if (action === 'increase-rate') {
          this.increaseSegmentRate(segmentId);
        }
      }
    }
  }

  private handleInputChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    
    if (target.classList.contains('rate-input')) {
      const segmentId = target.getAttribute('data-segment-id');
      if (segmentId) {
        const newRate = parseFloat(target.value) / 100;
        if (!isNaN(newRate) && newRate >= 0.05 && newRate <= 1.6) {
          this.updateSegmentRate(segmentId, newRate);
        }
      }
    }
  }

  private handleInputBlur = (e: Event) => {
    const target = e.target as HTMLInputElement;
    
    if (target.classList.contains('time-input')) {
      const segmentId = target.getAttribute('data-segment-id');
      const timeType = target.getAttribute('data-time-type');
      
      if (segmentId && timeType) {
        const timeValue = this.parseTimeInput(target.value);
        if (timeValue !== null) {
          if (timeType === 'start') {
            this.updateSegmentStartTime(segmentId, timeValue);
          } else if (timeType === 'end') {
            this.updateSegmentEndTime(segmentId, timeValue);
          }
        } else {
          // 잘못된 입력이면 원래 값으로 복원
          this.refreshState();
        }
      }
    }
  }

  private handleInputKeydown = (e: KeyboardEvent) => {
    const target = e.target as HTMLInputElement;
    
    if (target.classList.contains('time-input')) {
      if (e.key === 'Enter') {
        target.blur(); // blur 이벤트로 저장 처리
      } else if (e.key === 'Escape') {
        this.refreshState(); // 원래 값으로 복원
      }
    }
  }

  async activateSegment(segmentId: string) {
    try {
      await this.sendMessageToContentScript({ type: 'ACTIVATE_SEGMENT', segmentId });
      
      // 활성 상태 토글
      const isCurrentlyActive = this.profile?.activeSegmentId === segmentId;
      this.updateSegmentState(segmentId, !isCurrentlyActive);
      
      setTimeout(() => this.refreshState(), 500);
    } catch (error) {
      console.error('구간 활성화 실패:', error);
      const errorMessage = error instanceof Error && error.message.includes('Receiving end does not exist') 
        ? 'YouTube 페이지를 새로고침한 후 다시 시도해주세요.'
        : '구간 활성화에 실패했습니다.';
      this.showError(errorMessage);
    }
  }

  async deleteSegment(segmentId: string) {
    try {
      await this.sendMessageToContentScript({ type: 'DELETE_SEGMENT', segmentId });
      this.refreshState();
    } catch (error) {
      console.error('구간 삭제 실패:', error);
      const errorMessage = error instanceof Error && error.message.includes('Receiving end does not exist') 
        ? 'YouTube 페이지를 새로고침한 후 다시 시도해주세요.'
        : '구간 삭제에 실패했습니다.';
      this.showError(errorMessage);
    }
  }

  private editSegmentLabel(segmentId: string) {
    // 더 안전한 DOM 선택자 사용
    const segmentItem = document.querySelector(`[data-segment-id="${segmentId}"]`);
    if (!segmentItem) {
      console.error('구간 아이템을 찾을 수 없습니다:', segmentId);
      return;
    }
    
    const labelElement = segmentItem.querySelector('.label-text');
    
    if (!labelElement) {
      console.error('라벨 요소를 찾을 수 없습니다');
      return;
    }

    const currentLabel = labelElement.textContent || '';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'label-input';
    input.value = currentLabel;
    
    // 기존 라벨을 입력창으로 교체
    labelElement.parentNode?.replaceChild(input, labelElement);
    input.focus();
    input.select();

    // 엔터키나 포커스 아웃 시 저장
    const saveLabel = () => {
      const newLabel = input.value.trim();
      
      if (newLabel && newLabel !== currentLabel) {
        this.updateSegmentLabel(segmentId, newLabel);
      } else {
        // 변경사항이 없으면 원래 라벨로 복원
        const newLabelElement = document.createElement('span');
        newLabelElement.className = 'label-text';
        newLabelElement.textContent = currentLabel;
        input.parentNode?.replaceChild(newLabelElement, input);
      }
    };

    input.addEventListener('blur', saveLabel);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        saveLabel();
      } else if (e.key === 'Escape') {
        // ESC 키로 취소
        const newLabelElement = document.createElement('span');
        newLabelElement.className = 'label-text';
        newLabelElement.textContent = currentLabel;
        input.parentNode?.replaceChild(newLabelElement, input);
      }
    });
  }

  private async setSegmentStartTime(segmentId: string) {
    try {
      const response = await this.sendMessageToContentScript({ type: 'GET_CURRENT_TIME' });
      
      if (response?.currentTime !== undefined && !isNaN(response.currentTime)) {
        this.updateSegmentStartTime(segmentId, response.currentTime);
      } else {
        this.showError('현재 시간을 가져올 수 없습니다.');
      }
    } catch (error) {
      console.error('현재 시간 가져오기 실패:', error);
      this.showError('현재 시간을 가져올 수 없습니다.');
    }
  }

  private async setSegmentEndTime(segmentId: string) {
    try {
      const response = await this.sendMessageToContentScript({ type: 'GET_CURRENT_TIME' });
      
      if (response?.currentTime !== undefined && !isNaN(response.currentTime)) {
        this.updateSegmentEndTime(segmentId, response.currentTime);
      } else {
        this.showError('현재 시간을 가져올 수 없습니다.');
      }
    } catch (error) {
      console.error('현재 시간 가져오기 실패:', error);
      this.showError('현재 시간을 가져올 수 없습니다.');
    }
  }

  private async updateSegmentLabel(segmentId: string, newLabel: string) {
    try {
      await this.sendMessageToContentScript({ type: 'UPDATE_SEGMENT', segmentId, label: newLabel });
      this.showSuccess('라벨이 수정되었습니다.');
      this.refreshState();
    } catch (error) {
      console.error('라벨 수정 실패:', error);
      this.showError('라벨 수정에 실패했습니다.');
    }
  }

  private async updateSegmentStartTime(segmentId: string, newStartTime: number) {
    try {
      await this.sendMessageToContentScript({ type: 'UPDATE_SEGMENT', segmentId, start: newStartTime });
      this.showSuccess('시작 시간이 설정되었습니다.');
      this.refreshState();
    } catch (error) {
      console.error('시작 시간 설정 실패:', error);
      this.showError('시작 시간 설정에 실패했습니다.');
    }
  }

  private async updateSegmentEndTime(segmentId: string, newEndTime: number) {
    try {
      await this.sendMessageToContentScript({ type: 'UPDATE_SEGMENT', segmentId, end: newEndTime });
      this.showSuccess('종료 시간이 설정되었습니다.');
      this.refreshState();
    } catch (error) {
      console.error('종료 시간 설정 실패:', error);
      this.showError('종료 시간 설정에 실패했습니다.');
    }
  }

  private async updateSegmentRate(segmentId: string, newRate: number) {
    try {
      await this.sendMessageToContentScript({ type: 'UPDATE_SEGMENT', segmentId, rate: newRate });
      
      // UI 즉시 업데이트 - 더 안전한 선택자 사용
      const rateValueElement = document.querySelector(`[data-segment-id="${segmentId}"] .rate-input`);
      if (rateValueElement) {
        (rateValueElement as HTMLInputElement).value = `${Math.round(newRate * 100)}`;
      }
    } catch (error) {
      console.error('재생속도 설정 실패:', error);
      this.showError('재생속도 설정에 실패했습니다.');
    }
  }

  private parseTimeInput(timeString: string): number | null {
    // 시간 형식 파싱 (예: "1:30", "0:45", "90")
    const trimmed = timeString.trim();
    
    if (!trimmed) return null;
    
    // "분:초" 형식 파싱
    const parts = trimmed.split(':');
    if (parts.length === 2) {
      const minutes = parseInt(parts[0], 10);
      const seconds = parseInt(parts[1], 10);
      
      if (!isNaN(minutes) && !isNaN(seconds) && minutes >= 0 && seconds >= 0 && seconds < 60) {
        return minutes * 60 + seconds;
      }
      return null; // 초가 60 이상이거나 잘못된 형식
    }
    
    // 초 단위만 입력된 경우
    const totalSeconds = parseInt(trimmed, 10);
    if (!isNaN(totalSeconds) && totalSeconds >= 0) {
      return totalSeconds;
    }
    
    return null;
  }

  private editSegment(segmentId: string) {
    const segmentItem = document.querySelector(`[data-segment-id="${segmentId}"]`);
    if (!segmentItem) {
      console.error('구간 아이템을 찾을 수 없습니다:', segmentId);
      return;
    }

    // 편집 모드 토글
    const isEditing = segmentItem.classList.contains('edit-mode');
    
    if (isEditing) {
      // 편집 모드 종료
      segmentItem.classList.remove('edit-mode');
      this.showSuccess('편집 모드가 종료되었습니다.');
    } else {
      // 편집 모드 시작
      segmentItem.classList.add('edit-mode');
      this.showSuccess('편집 모드가 활성화되었습니다. 시간과 속도를 직접 편집할 수 있습니다.');
    }
  }

  private decreaseSegmentRate(segmentId: string) {
    const segment = this.profile?.segments.find(s => s.id === segmentId);
    if (!segment) return;
    
    const currentRate = segment.rate;
    const newRate = Math.max(0.05, currentRate - 0.05); // 5% 감소, 최소 5%
    
    this.updateSegmentRate(segmentId, newRate);
  }

  private increaseSegmentRate(segmentId: string) {
    const segment = this.profile?.segments.find(s => s.id === segmentId);
    if (!segment) return;
    
    const currentRate = segment.rate;
    const newRate = Math.min(1.6, currentRate + 0.05); // 5% 증가, 최대 160%
    
    this.updateSegmentRate(segmentId, newRate);
  }
}

// 전역 인스턴스 생성
const popupController = new PopupController();

// DOM 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
  popupController.init();
}); 