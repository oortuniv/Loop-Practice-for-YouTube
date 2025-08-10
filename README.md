유튜브에서 구간 반복(A-B), 구간별 속도, 자동 저장/불러오기, 단축키, 탭 템포/메트로놈/카운트인을 제공하는 Chrome MV3 확장입니다.

핵심 기능

여러 구간 저장(겹침 허용), 활성 구간 반복

구간별 재생 속도 적용 + 전역 기본 속도

같은 영상 재방문 시 자동 적용

단축키: Space(재생/일시정지), L(루프 토글), [/](이전/다음 구간), -/=(속도 ±), T(탭 템포), M(메트로놈), C(카운트인)

설치(개발용)

이 저장소 클론 또는 폴더 준비

Chrome → chrome://extensions → Developer mode On

Load unpacked → 이 폴더 선택

유튜브 영상 페이지 진입 → 우하단 패널 표시

폴더 구조

/yt-loop-practice
  ├─ manifest.json
  ├─ background.js
  ├─ content.js
  ├─ storage.js
  ├─ overlay.css
  ├─ /icons
  └─ /.cursorrules         ← Cursor 가드레일

아키텍처 & 가드레일

Manifest V3 유지, remote code 금지

대상 URL: youtube.com/watch*, youtu.be/* (쇼츠 제외)

Overlay는 Shadow DOM 사용(스타일 오염 방지)

루프 로직은 전담 모듈에서만 변경(중복 구현 금지)

저장 스키마:

type LoopSegment = { id: string; start: number; end: number; rate: number; label?: string };
type VideoProfile = {
  videoId: string;
  defaultRate: number;
  segments: LoopSegment[];
  activeSegmentId?: string | null;
  bpm?: number;
  countInBeats?: number;
  metronomeEnabled?: boolean;
  schemaVersion?: number;
};

개발 워크플로우

브랜치: main(배포), dev(통합), feat/*, fix/*

커밋: Conventional Commits(feat:, fix:, refactor: 등)

변경 전 .cursorrules 재확인 → 범위 밖 요구사항은 ADR로 제안

수락 기준(AC) 작성 예시

end 경계에서 1프레임 깜빡임 제거

이전/다음 구간 이동과 충돌 없음

권한/번들 크기 증가 없음

문서/테스트 업데이트

테스트

수동 시나리오(최소):

루프 시작/종료 정확도(±0.01s 이내)

재방문 자동 적용

겹치는 구간 우선순위(사용자 활성 구간 우선)

단축키/메트로놈/카운트인 정상 동작

선택: Playwright로 간단 E2E 스크립트

마이그레이션 가이드

schemaVersion 도입(기본 1) → 시작 시 버전 확인 후 변환

예:

const MIGRATIONS = {
  1: p => p,
  2: p => ({ ...p, countInBeats: p.countInBeats ?? 4 }),
  3: p => ({ ...p, segments: p.segments.map(s => ({ ...s, label: s.label ?? '' })) }),
};

변경 시 CHANGELOG.md에 사용자 영향 기록

이슈 템플릿

제목: [fix/feat] 한 줄 요약
목적(왜):
범위(무엇):
비목표:
수락 기준(AC):
1)
2)
3) 권한/성능 영향 없음
재현/검증 방법:
리스크/롤백:

PR 템플릿

## 변경 요약
- …

## 스크린샷/영상
- (있다면 첨부)

## 테스트 결과
- 유닛/E2E/수동 체크 목록

## 문서/CHANGELOG
- [ ] 업데이트 포함

## 권한/성능 영향
- 없음 / (있다면 상세)

ADR 템플릿 (docs/adr/0000-template.md)

# 제목
상태: 제안/승인/폐기
날짜: YYYY-MM-DD

## 배경
문제/상황

## 대안
- 대안 A / B / C

## 결정
선택한 안, 이유

## 트레이드오프
장단점, 리스크

## 영향
코드/권한/문서/사용자 영향

## 후속 작업
테스트/마이그레이션/릴리즈 계획

릴리즈

SemVer 기준 버전 증가

권한 변경 시 최소 마이너 이상, 스토어 설명/스크린샷 갱신

문제가 생기면 이전 태그로 즉시 롤백

