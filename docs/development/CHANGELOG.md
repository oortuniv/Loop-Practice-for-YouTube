# Changelog

모든 주요 변경사항은 이 파일에 기록됩니다.

형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.0.0/)를 따릅니다.

## [Unreleased]

### 2025-12-29 (Session 02 - Part 8 Final)

#### Changed
- 🔄 **메트로놈 기능 임시 비활성화**
  - 글로벌 싱크 및 메트로놈 기능이 의도대로 동작하지 않아 UI에서 숨김
  - 모든 메트로놈 관련 로직은 보존 (향후 재활성화 대비)
  - Global Sync 설정 UI 주석 처리
  - 루프 카드의 메트로놈 버튼 주석 처리
  - 메트로놈 클릭음 재생 비활성화 (`scheduleClick` 메서드 early return)
  - 파일: `src/content/ui-controller.ts:292-323, 451-464`
  - 파일: `src/content/audio/metronome.ts:184-217`

### 2025-12-29 (Session 02 - Part 8 Continued)

#### Added
- ✨ **글로벌 싱크 전용 메트로놈 기능** (현재 비활성화)
  - Global Sync 설정 옆에 독립적인 메트로놈 버튼 추가
  - 메트로놈 활성화 시 모든 루프 자동 비활성화 (일반 YouTube 재생 모드)
  - 루프 설정과 독립적으로 메트로놈만 재생하여 싱크 조정 가능
  - 비디오 재생/일시정지 시 자동으로 메트로놈 시작/중지
  - 파일: `src/content/ui-controller.ts:14, 105-107, 287-294, 1413-1417, 2349-2368`
  - 파일: `src/content/index.ts:293-295, 594-622`
  - 파일: `src/content/loops.ts:11, 24-42, 436-476`

#### Changed
- 🔄 **글로벌 싱크 설정 UI 레이아웃 개선** (현재 비활성화)
  - Tempo와 Time Signature를 같은 줄에 배치 (2열 레이아웃)
  - Global Sync를 별도 줄에 배치하여 잘림 현상 방지
  - BPM/박자표 미설정 시에도 Global Sync 표시 (비활성화 상태)
  - 파일: `src/content/ui-controller.ts:256-305, 564-573`

- 🔄 **글로벌 싱크 드래그 성능 개선** (현재 비활성화)
  - 드래그 중에는 저장하지 않고 메트로놈만 실시간 업데이트
  - 드래그 종료 시 최종 값만 저장하여 성능 향상
  - 비디오 일시정지 상태에서는 메트로놈 재시작하지 않음
  - 파일: `src/content/ui-controller.ts:2257-2301`, `src/content/index.ts:260-288`

### 2025-12-29 (Session 02 - Part 7)

#### Added
- ✨ **글로벌 메트로놈 싱크 설정 기능**
  - 영상 전체에 걸친 글로벌 메트로놈 오프셋 설정
  - 템포 설정 하단에 Global Sync 입력 필드 추가
  - xx.xxx 초 단위로 정밀 설정 (양수/음수 지원)
  - 드래그로 실시간 조정 가능
  - SYNC 버튼으로 설정 저장 및 확인 다이얼로그
  - 비디오 재생 시 실시간으로 메트로놈 싱크 반영
  - 파일: `src/types.ts:19`, `src/content/ui-controller.ts:275-295, 640-699, 1375-1387, 2227-2313`
  - 파일: `src/content/index.ts:260-278`, `src/content/loops.ts:390-419`

#### Fixed
- 🐛 **메트로놈 버튼 간섭 문제 완전 해결**
  - `isMetronomeActive()`가 `metronomeActiveSegmentId` 대신 세그먼트의 `metronomeEnabled` 속성 확인
  - 사용하지 않는 `metronomeActiveSegmentId` 속성 제거
  - 각 루프 카드의 메트로놈 버튼이 독립적으로 동작
  - 파일: `src/content/ui-controller.ts:97-100, 132-136`

#### Changed
- 🔄 **루프별 개별 싱크 기능 비활성화**
  - 현재는 글로벌 싱크만 지원 (추후 루프별 디테일 설정 예정)
  - 곡 중간에 BPM/박자 변경이 없는 경우 정확한 싱크 제공
  - 글로벌 싱크 기반으로 모든 루프에서 일관된 메트로놈 동작

### 2025-12-29 (Session 02 - Part 6)

#### Added
- ✨ **메트로놈 클릭음 시간 캐싱 기능**
  - 루프의 BPM, 박자표, 길이를 기반으로 클릭음 시간 미리 계산
  - 동일한 설정에서는 캐시된 값 재사용
  - 루프 start/end, BPM, 박자표 변경 시에만 재계산
  - 최대 60초까지 beat 정보 캐싱 (루프 길이 기준)
  - 파일: `src/content/audio/metronome.ts:28-31, 44-98, 232-254`
  - 파일: `src/content/loops.ts:390-412`

#### Fixed
- 🐛 **Per-segment 메트로놈 시스템 구현**
  - 전역 메트로놈 상태 제거 → 세그먼트별 독립적 메트로놈 관리
  - 메트로놈 토글 시 잘못된 카드 설정이 변경되던 버그 완전 해결
  - 각 루프가 독립적인 `metronomeEnabled` 속성 보유
  - 파일: `src/types.ts:7`, `src/content/loops.ts:333-377`, `src/content/index.ts:257, 496-511`

- 🐛 **루프 비활성화 시 메트로놈 중지 보완**
  - `setProfile()` 메서드에서 루프 비활성화 시 메트로놈 자동 중지
  - 모든 루프 비활성화 경로에서 메트로놈 정상 중지 보장
  - 파일: `src/content/loops.ts:50-55`

### 2025-12-29 (Session 02 - Part 5)

#### Fixed
- 🐛 **비디오 일시정지 시 메트로놈 중지 개선**
  - `metronomeEnabled` 체크 대신 `metronome.isRunning()` 체크로 변경
  - 실제 재생 중인 메트로놈만 정확히 중지
  - 파일: `src/content/loops.ts:25-28`

- 🐛 **루프 점프 시 메트로놈 재시작 로직 개선**
  - `resync` 대신 `stop` + `start` 방식으로 변경
  - 루프 시작점부터 beat 0으로 정확히 재시작
  - `resyncMetronome` 함수 제거 (불필요)
  - 파일: `src/content/loops.ts:148-153`

#### Changed
- 🔄 **메트로놈 토글 조건 완화**
  - 루프 비활성화 상태에서도 메트로놈 설정 가능
  - BPM과 박자표만 설정되어 있으면 토글 가능
  - 루프 활성화 시 자동으로 메트로놈 재생
  - 파일: `src/content/ui-controller.ts:401, 120-122`

### 2025-12-29 (Session 02 - Part 4)

#### Fixed
- 🐛 **메트로놈 동작 문제 수정**
  - 루프 비활성화 시 메트로놈이 계속 재생되던 문제 해결
  - `setActive(null)` 호출 시 메트로놈 자동 정지
  - 파일: `src/content/loops.ts:87-94`

- 🐛 **루프 변경 시 메트로놈 재시작 기능 추가**
  - 다른 루프로 전환 시 메트로놈이 새 루프에 맞춰 재시작
  - `setActive(id)` 호출 시 메트로놈 자동 재시작
  - 파일: `src/content/loops.ts:79-86`

- 🐛 **루프 시간 수정 시 메트로놈 재시작**
  - Start 또는 End 시간 변경 시 메트로놈 자동 재시작
  - 박자가 변경된 루프에 정확히 동기화
  - 파일: `src/content/loops.ts:299-304`

#### Changed
- 🔄 **메트로놈 버튼 UI 개선**
  - ON 상태: 우드톤 테두리(#8B6F47, 2px)로 변경
  - 기존 파란색 배경 + 애니메이션 제거
  - 배경은 기본 상태 유지, 테두리만 변경
  - 파일: `src/content/ui-controller.ts:1109-1114`

### 2025-12-29 (Session 02 - Part 3)

#### Changed
- 🔄 **Start, End, Speed 입력 필드 레이아웃 재조정**
  - `time-input`을 `flex: 1`로 변경하여 공간에 맞게 자동 조정
  - `rate-input-container`도 `flex: 1`로 변경하여 통일성 확보
  - End 줄의 시계 버튼 정상 표시
  - 세 줄의 총 길이 균형 조정
  - 파일: `src/content/ui-controller.ts:943-956, 1024-1030`

- 🔄 **Bar 선택 옵션 확장**
  - 기존: 1, 2, 4, 8, 16 bars만 선택 가능
  - 변경: 1부터 16까지 모든 양의 정수 bars 선택 가능
  - Loop 생성 및 End 시간 수정 시 모두 적용
  - 파일: `src/content/ui-controller.ts:150-155, 187-194`

#### Added
- ✨ **카드 접기/펼치기 시 자동 스크롤**
  - 카드를 펼쳤을 때 하단이 잘리면 자동으로 스크롤
  - 마지막 카드가 항상 온전히 보이도록 보장
  - 10px 여유 공간 추가
  - 파일: `src/content/ui-controller.ts:1979-1995`

### 2025-12-29 (Session 02 - Part 2)

#### Changed
- 🔄 **Start, End, Speed 입력 필드 레이아웃 통일**
  - 세 줄의 label 너비를 모두 38px로 통일
  - `rate-control-group`의 gap을 6px → 4px로 조정
  - 시각적 일관성 향상
  - 파일: `src/content/ui-controller.ts:927-1009`

#### Fixed
- 🐛 **End 시간 입력 필드의 시계 버튼 잘림 해결**
  - `time-set-btn`에 `flex-shrink: 0` 추가
  - 명시적 크기 지정: `width: 24px`, `height: 24px`
  - bar-select 추가로 인한 공간 부족 문제 해결
  - 파일: `src/content/ui-controller.ts:977-991`

- 🐛 **Loop name 입력 필드 디자인 통일**
  - 기존 focus 시 파란 테두리 → bar-select와 동일한 스타일로 변경
  - `border-color`: #065fd4 (항상) → `${inputBorder}` (기본)
  - `font-size`: 13px → 11px (다른 select와 동일)
  - 파일: `src/content/ui-controller.ts:908-925`

- 🐛 **드래그 시 커서 모양 개선**
  - `segment-item` 기본 커서: `move` → `default`
  - `segment-item.dragging` 커서: `grabbing` → `default`
  - 사용자 경험 개선
  - 파일: `src/content/ui-controller.ts:762, 776`

### 2025-12-29 (Session 02 - Part 1)

#### Changed
- 🔄 **루프 이름 입력 방식 개선**
  - Select 박스에서 Input + Datalist로 변경
  - 텍스트 직접 입력으로 커스텀 이름 설정 가능
  - 드롭다운 클릭 시 프리셋(Intro, Verse, Chorus, Bridge, Outro) 선택 가능
  - 파일: `src/content/ui-controller.ts:289-304, 1350-1363`

- 🔄 **펼쳐진 카드에서 중복 정보 제거**
  - 카드 펼친 상태에서는 시간 범위(0:02.306 ~ 0:16.851) 표시 안 함
  - 접힌 상태에서만 시간 범위 표시
  - 이유: Start/End 입력 필드에서 이미 확인 가능
  - 파일: `src/content/ui-controller.ts:350-357`

- 🔄 **입력 필드 너비 조정 및 통일**
  - `time-input` (Start/End): 65px → 80px
  - `bar-select`: 55px → 70px
  - `rate-input-container`: flex: 1 → flex: 0 0 80px
  - `rate-input`: min-width: 40px → 50px
  - 텍스트 잘림 현상 해결 및 시각적 통일성 향상
  - 파일: `src/content/ui-controller.ts:926-949, 1003-1039`

- 🔄 **접힌 카드 높이 최적화**
  - 접힌 카드의 패딩 축소: 12px → 8px (상하만)
  - 헤더의 margin-bottom 제거 (접힌 상태에서)
  - 펼쳐진 카드의 헤더 높이와 동일하게 조정
  - 파일: `src/content/ui-controller.ts:791-797`

### 2025-12-29 (Session 01)

#### Added
- ✨ **카드 접기/펼치기 기능**
  - 각 루프 카드를 개별적으로 접기/펼치기 가능
  - 접힌 상태를 localStorage에 저장하여 페이지 새로고침 후에도 유지
  - 접힌 상태에서는 제목, 시간 범위, 컴팩트 루프 버튼, 메뉴 버튼만 표시
  - 파일: `src/content/ui-controller.ts`

- ✨ **드래그 앤 드롭으로 카드 순서 변경**
  - 카드의 빈 영역을 드래그하여 순서 변경 가능
  - 버튼, 입력 필드 등은 드래그에서 제외
  - 드래그 중 시각적 피드백 (opacity, border 효과)
  - 파일: `src/content/ui-controller.ts`, `src/content/index.ts`

- ✨ **루프 레이블 프리셋**
  - Select 드롭다운으로 변경 (기존 datalist 대체)
  - 프리셋: Intro, Verse, Chorus, Bridge, Outro
  - "Custom..." 옵션 선택 시 사용자 정의 입력 가능
  - 파일: `src/content/ui-controller.ts`

- ✨ **Bar 기반 루프 생성 개선**
  - BPM/박자표 설정 시 bar 단위 옵션 우선 표시
  - 기본값: 8 bars (기존 2 bars에서 변경)
  - Bar 옵션: 1, 2, 4, 8, 16 bars
  - 파일: `src/content/ui-controller.ts`

#### Fixed
- 🐛 **BPM 수정 문제 해결**
  - 카드를 접은 후 BPM 수정 및 TAP tempo가 작동하지 않던 문제 수정
  - 원인: `handleToggleCollapse()`에서 `setupEventListeners()` 누락
  - 파일: `src/content/ui-controller.ts:1565`

- 🐛 **접힌 상태 저장 문제 해결**
  - 페이지 새로고침 시 접힌 카드가 펼쳐지던 문제 수정
  - `loadCollapsedState()`를 `init()` 메서드에서 호출하도록 수정
  - 파일: `src/content/ui-controller.ts:33`

#### Changed
- 🔄 **드래그 핸들 아이콘 제거**
  - 드래그 핸들 대신 접기/펼치기 버튼으로 교체
  - 카드 순서 변경은 여전히 드래그로 가능
  - 파일: `src/content/ui-controller.ts`

## [Previous Versions]

### 2025-12-27 (추정)

#### Added
- ✨ **메트로놈 기능 구현**
  - Web Audio API 기반 정확한 클릭음 생성
  - Look-ahead 스케줄링 (100ms 앞서 스케줄, 25ms마다 체크)
  - 첫 박 강조 (낮은 음높이, 높은 볼륨)
  - 파일: `src/content/audio/metronome.ts`, `src/content/loops.ts`

- ✨ **Bar-Time 변환 기능**
  - BPM과 박자표를 기반으로 마디(bar) ↔ 초(seconds) 변환
  - 유틸리티 함수: `barsToSeconds()`, `secondsToBars()`, `parseTimeSignature()`
  - 파일: `src/utils.ts`

- ✨ **Bar 기반 루프 생성**
  - Duration 드롭다운에 bar 단위 옵션 추가
  - BPM 미설정 시 초 단위만 표시
  - 파일: `src/content/ui-controller.ts`, `src/content/index.ts`

- ✨ **Bar 선택 박스 (End 시간 수정용)**
  - End 시간 옆에 bar 단위 선택 박스 추가
  - Start 시간으로부터의 상대 길이를 bar로 표시
  - 파일: `src/content/ui-controller.ts`

#### Changed
- 🔄 **루프 tick 간격 단축**
  - 100ms → 50ms로 변경하여 루프 점프 정확도 향상
  - 파일: `src/content/loops.ts:16`

### Initial Release

#### Added
- ✨ **기본 루프 기능**
  - YouTube 비디오에서 구간 반복 재생
  - 다중 루프 구간 생성 및 관리
  - 구간별 재생 속도 조절
  - Chrome Storage Sync를 통한 데이터 저장

- ✨ **UI 컴포넌트**
  - YouTube 페이지 우측 (`#secondary`)에 UI 주입
  - Shadow DOM을 사용한 스타일 격리
  - 다크/라이트 테마 자동 감지

- ✨ **기본 제어**
  - Start/End 시간 수정 (드래그 또는 직접 입력)
  - 현재 시간으로 시간 설정 (⏱️ 버튼)
  - 재생 속도 조절 (드래그 또는 ±버튼)
  - 루프 삭제

---

## 업데이트 가이드

새로운 변경사항을 추가할 때:

1. 날짜별로 구분 (`### YYYY-MM-DD`)
2. 카테고리별로 분류:
   - `Added`: 새로운 기능
   - `Changed`: 기존 기능 변경
   - `Deprecated`: 곧 제거될 기능
   - `Removed`: 제거된 기능
   - `Fixed`: 버그 수정
   - `Security`: 보안 관련
3. 이모지 사용:
   - ✨ Added
   - 🔄 Changed
   - 🗑️ Deprecated
   - ❌ Removed
   - 🐛 Fixed
   - 🔒 Security
