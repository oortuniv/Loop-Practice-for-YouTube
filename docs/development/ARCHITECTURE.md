# Architecture Overview

## 프로젝트 구조

```
src/
├── manifest.ts              # Chrome Extension Manifest V3 설정
├── background.ts            # Service Worker (현재 키보드 단축키 비활성화)
├── popup.ts/html            # Extension 팝업 UI
├── types.ts                 # TypeScript 타입 정의
├── utils.ts                 # 공통 유틸리티 함수
└── content/                 # Content Script (YouTube 페이지에 주입)
    ├── index.ts             # 메인 진입점, 비즈니스 로직
    ├── loops.ts             # LoopController - 루프 제어 로직
    ├── storage.ts           # Chrome Storage API 래퍼
    ├── ui-controller.ts     # UIController - UI 렌더링 및 이벤트 처리
    ├── ui.ts                # YouTubeUI - DOM 주입
    └── audio/
        └── metronome.ts     # Metronome - Web Audio API 기반 메트로놈
```

## 핵심 컴포넌트

### 1. Content Script (`src/content/index.ts`)
- YouTube 비디오 페이지에 주입되는 메인 스크립트
- 비디오 요소 감지 및 초기화
- VideoProfile 관리 (Chrome Storage 연동)
- UIController, LoopController 생명주기 관리

### 2. UIController (`src/content/ui-controller.ts`)
- UI 렌더링 (Shadow DOM 사용)
- 사용자 이벤트 처리
- 테마 감지 (다크/라이트 모드)
- 상태:
  - `collapsedSegments: Map<string, boolean>` - 카드 접힌 상태 (localStorage 저장)
  - `draggedSegmentId: string | null` - 드래그 중인 카드 ID

**주요 메서드**:
- `render()`: HTML 생성 및 렌더링
- `setupEventListeners()`: 이벤트 리스너 등록
- `handleToggleCollapse()`: 카드 접기/펼치기
- `handleDragStart/Over/Drop/End()`: 드래그 앤 드롭 처리

### 3. LoopController (`src/content/loops.ts`)
- 루프 재생 로직 (비디오 currentTime 모니터링)
- 메트로놈 생명주기 관리
- 재생 속도 제어

**주요 메서드**:
- `tick()`: 50ms마다 호출되어 루프 체크 (throttled)
- `setActive(id)`: 활성 루프 변경
- `toggleMetronome()`: 메트로놈 on/off

### 4. Metronome (`src/content/audio/metronome.ts`)
- Web Audio API 기반 정확한 클릭음 생성
- Look-ahead 스케줄링 (100ms 앞서 스케줄, 25ms마다 체크)
- Beat 동기화 (루프 점프 시 beat 0부터 재시작)

**음향 특성**:
- 첫 박: 800Hz, 볼륨 0.5
- 다른 박: 1200Hz, 볼륨 0.3
- Click 지속시간: 50ms

### 5. YouTubeUI (`src/content/ui.ts`)
- `#secondary` 영역에 UI 컨테이너 주입
- Shadow DOM 생성 및 관리
- DOM 정리 (중복 컨테이너 제거)

## 데이터 흐름

```
User Interaction (UI)
    ↓
UIController.handleSegmentClick()
    ↓
UIController.onCommand('command-name', data)
    ↓
index.ts handleUICommand()
    ↓
LoopController / Storage
    ↓
index.ts saveProfile() → Chrome Storage
    ↓
index.ts refreshUI()
    ↓
UIController.updateProfile() → render()
```

## 주요 타입

```typescript
// VideoProfile: 비디오별 저장되는 데이터
{
  videoId: string;
  defaultRate: number;
  segments: LoopSegment[];
  activeSegmentId?: string | null;
  tempo?: number;              // BPM
  timeSignature?: TimeSignature; // "4/4", "3/4" 등
  videoTitle?: string;
  channelName?: string;
}

// LoopSegment: 개별 루프 구간
{
  id: string;
  start: number;
  end: number;
  rate: number;
  label?: string;
}
```

## Storage 구조

### Chrome Storage (Sync)
```javascript
{
  "vid:dQw4w9WgXcQ": {  // videoId를 키로 사용
    videoId: "dQw4w9WgXcQ",
    segments: [...],
    tempo: 120,
    // ...
  }
}
```

### localStorage
```javascript
{
  "loop-practice-collapsed-segments": {
    "segment-id-1": true,   // 접힌 상태
    "segment-id-2": false,  // 펼쳐진 상태
  }
}
```

## 이벤트 처리 패턴

UI는 **이벤트 위임(Event Delegation)** 사용:

```typescript
// ❌ 각 버튼마다 리스너 등록 (비효율)
buttons.forEach(btn => btn.addEventListener('click', ...))

// ✅ 부모에 하나만 등록
segmentsList.addEventListener('click', (e) => {
  const action = e.target.dataset.action;
  switch(action) {
    case 'jump-and-activate': ...
    case 'toggle-metronome': ...
  }
})
```

## 성능 최적화

1. **Throttling**: 루프 체크 tick() - 50ms 간격
2. **Event Delegation**: 동적 요소에 대한 이벤트 처리
3. **Shadow DOM**: CSS 격리로 YouTube 스타일과 충돌 방지
4. **Look-ahead Scheduling**: 메트로놈 정확도 향상

## 알려진 제약사항

1. Chrome Extension Manifest V3 사용
2. YouTube 페이지 구조 변경에 취약할 수 있음 (`#secondary` 의존)
3. localStorage는 동일 videoId라도 다른 브라우저 탭 간 공유되지 않음
4. 메트로놈은 AudioContext 사용 - 사용자 인터랙션 후에만 재생 가능

## 개발 환경

- **빌드**: `npm run build` - TypeScript 컴파일 + Vite 번들링
- **테스트**: Vitest (현재 테스트 파일 삭제됨)
- **브라우저**: Chrome Extension 로드 (chrome://extensions)
