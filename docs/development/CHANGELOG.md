# Changelog

모든 주요 변경사항은 이 파일에 기록됩니다.

형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.0.0/)를 따릅니다.

## [Unreleased]

### 2026-01-02 (Session 02 - Double Beat Fix)

#### Fixed
- 🐛 **루프 재시작 시 더블비트 문제 해결**
  - RAF 기반 루프 감지를 메트로놈 기반(10ms 폴링)으로 변경
  - `resync()`에서 이미 지나간 박 스킵 로직 추가
  - `playing` 이벤트에서 `isJumping`, `isRunning()` 체크로 중복 시작 방지
  - 부동소수점 비교에 EPSILON(1ms) 적용
  - 파일: `src/content/audio/metronome.ts`, `src/content/loops.ts`

### 2026-01-02 (Session 01 - Loop Beat Sync & Quantize)

#### Added
- ✨ **루프 Quantize 기능**
  - 루프 시작/끝을 가장 가까운 박에 스냅
  - 사용법: 루프 카드 메뉴 → Quantize
  - 파일: `src/content/index.ts`

- ✨ **루프별 Beat Sync 설정**
  - 각 루프가 독립적인 BPM, 박자표, 오프셋 설정 가능
  - 사용법: 루프 카드 메뉴 → Beat Sync → "Use custom settings" 체크
  - 파일: `src/content/ui-controller.ts`, `src/types.ts`

- ✨ **TAP Sync 템포 정확도 점수**
  - 일관성(70%) + 템포 정확도(30%) 가중치 적용
  - 최소 6회 탭 전까지 "--%" 표시
  - 파일: `src/content/ui-controller.ts`

#### Changed
- 🔄 **메트로놈 pause/resume 타이밍 정확도 향상**
  - `play` 이벤트를 `playing` 이벤트로 변경
  - 파일: `src/content/loops.ts`

- 🔄 **메트로놈 볼륨 증가**
  - 기본 볼륨 0.8 → 0.9, 최대 볼륨 3.0 → 4.0
  - 파일: `src/content/audio/metronome.ts`

### 2026-01-01 (Session 03 - Custom Bars Dropdown UI)

#### Changed
- 🔄 **Bars 선택 UI를 커스텀 드롭다운으로 개선**
  - 1-32 bars까지 확장 지원 (기존 1-16)
  - 스크롤 가능한 커스텀 드롭다운 UI
  - 위/아래 화살표 인디케이터로 스크롤 가능 여부 표시
  - 두 곳 모두 적용: 루프 생성 Duration + 개별 세그먼트 bar-select
  - 파일: `src/content/ui-controller.ts`

### 2026-01-01 (Session 02 - TAP Tempo Algorithm Improvements)

#### Changed
- 🔄 **TAP Tempo 알고리즘 고도화**
  - 더블 클릭 필터: 50ms 이하 간격 무시 (실수로 인한 더블 클릭 방지)
  - 가중치 평균: 최근 탭에 높은 가중치 부여 (안정성 향상)
  - 이상치 리셋: 평균에서 ±50% 벗어나면 새 템포로 인식 (REAPER 스타일)
  - 파일: `src/content/ui-controller.ts:handleTapTempo()`

### 2026-01-01 (Session 01 - Loop UX Improvements)

#### Added
- ✨ **영상 정지 중 루프 활성화 시 자동 재생**
  - 비활성 루프 클릭 → 활성화 및 재생 시작
  - 활성 루프 클릭 (정지 중) → 시작점으로 이동 후 재생
  - 활성 루프 클릭 (재생 중) → 루프 비활성화
  - 파일: `src/content/index.ts:jumpAndActivateSegment()`

#### Changed
- 🔄 **Start/End time 변경 시 동작 개선**
  - Start time 변경(드래그) → 해당 위치에서 루프 재시작
  - End time 변경 → 재생 이어짐 (End가 현재 위치 이전이면 자동으로 Start로 이동)
  - `tick()`에서 최신 segment 정보를 profile에서 가져오도록 수정
  - 파일: `src/content/loops.ts:tick()`

- 🔄 **접힌 카드 시간 표시 두 줄로 변경**
  - 라벨 잘림 방지를 위해 Start/End 시간을 세로로 배치
  - 파일: `src/content/ui-controller.ts`

- 🔄 **페이지 새로고침/이동 시 활성 루프 초기화**
  - `loadProfile()` 및 `init()`에서 `activeSegmentId`를 `null`로 설정
  - 활성 구간 복원 로직 제거
  - 파일: `src/content/storage.ts`, `src/content/index.ts`

#### Fixed
- 🐛 **비디오 제목/채널명 불일치 버그 수정**
  - 페이지 이동 시 videoId 변경 감지 및 cleanup 처리
  - `navigationListenerRegistered` 플래그로 중복 리스너 방지
  - 파일: `src/content/index.ts`

### 2025-12-31 (Session 01 - Deployment Automation and Licensing)

#### Added
- 🚀 **GitHub Actions 배포 자동화**
  - 태그 기반 자동 빌드 및 GitHub Release 생성
  - main 브랜치 푸시 시 Artifacts 생성

- 📝 **배포 문서화**
  - `docs/DEPLOYMENT.md` - 배포 자동화 가이드

#### Changed
- 📜 **라이선스 변경: MIT → Proprietary**
  - 상업적 보호를 위해 독점 라이선스로 변경

---

## 업데이트 가이드

새로운 변경사항을 추가할 때:

1. 날짜별로 구분 (`### YYYY-MM-DD`)
2. 카테고리별로 분류:
   - `Added`: 새로운 기능
   - `Changed`: 기존 기능 변경
   - `Fixed`: 버그 수정
3. 이모지 사용:
   - ✨ Added
   - 🔄 Changed
   - 🐛 Fixed
