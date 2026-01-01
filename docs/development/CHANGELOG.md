# Changelog

모든 주요 변경사항은 이 파일에 기록됩니다.

형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.0.0/)를 따릅니다.

## [Unreleased]

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
