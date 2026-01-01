# Session 01: 루프별 Beat Sync 및 Quantize 기능

**날짜**: 2026-01-02
**작업자**: Claude Opus 4.5

## 📋 세션 목표

이번 세션에서 달성하려는 목표:

1. [x] 메트로놈 pause/resume 타이밍 정확도 향상
2. [x] TAP Sync 최소 표본 수 및 템포 정확도 점수 추가
3. [x] 루프 Quantize 기능 구현
4. [x] 루프별 독립 Beat Sync 설정 기능 구현
5. [x] Beat Sync 모달 YouTube 테마 대응

## 🔧 수정된 파일

### 1. `src/types.ts`

#### 변경사항
```typescript
export type LoopSegment = {
  // 기존 필드...

  // 로컬 Beat Sync 설정 (없거나 useGlobalSync가 true면 글로벌 설정 사용)
  useGlobalSync?: boolean;           // 기본값: true (글로벌 설정 사용)
  localTempo?: number;               // 로컬 BPM
  localTimeSignature?: TimeSignature; // 로컬 박자표
  localMetronomeOffset?: number;     // 로컬 첫 박 오프셋 (초 단위)
};
```

**변경 이유**: 가변 BPM/박자표를 가진 곡에서 각 루프가 독립적인 Beat Sync 설정을 가질 수 있도록 함

### 2. `src/content/loops.ts`

#### 변경사항
- `play` 이벤트를 `playing` 이벤트로 변경 (타이밍 정확도 향상)
- `getEffectiveSync()` 헬퍼 메서드 추가
- `startMetronome()` 수정하여 유효 설정(로컬 or 글로벌) 사용

**변경 이유**:
- `play` 이벤트는 재생 요청 시점에 발생하여 실제 재생과 수십~수백ms 차이 발생 가능
- 루프별 Beat Sync 설정 지원

### 3. `src/content/ui-controller.ts`

#### 변경사항
- `TAP_SYNC_MIN_SAMPLES = 6` 상수 추가
- `calculateTapSyncResult()` 수정: 템포 정확도 30% 가중치 추가
- 메뉴에 "Beat Sync", "Quantize" 항목 추가
- Beat Sync 모달 UI 구현 (~200줄)
- 모달 YouTube 다크/라이트 테마 대응

**변경 이유**: TAP Sync 점수 개선 및 루프별 Beat Sync 설정 UI 제공

### 4. `src/content/index.ts`

#### 변경사항
- `update-segment-sync` 커맨드 핸들러 추가
- `quantizeSegment()` 메서드 추가
- `getEffectiveSync()` 헬퍼 추가
- 루프 복제/생성 시 Beat Sync 설정 상속

### 5. `src/content/ui.ts`

#### 변경사항
```typescript
appendChild(element: HTMLElement): void {
  this.shadowRoot?.appendChild(element);
}

getElementById(id: string): HTMLElement | null {
  return this.shadowRoot?.getElementById(id) || null;
}
```

**변경 이유**: Beat Sync 모달을 Shadow DOM에 추가하기 위한 헬퍼 메서드

### 6. `src/content/audio/metronome.ts`

#### 변경사항
```typescript
private volume: number = 0.9;  // 0.8 → 0.9
private readonly MAX_VOLUME = 4.0;  // 3.0 → 4.0
```

**변경 이유**: 메트로놈 볼륨 증가 요청

## 🐛 수정된 버그

### Bug 1: 메트로놈 pause/resume 타이밍 드리프트
- **증상**: 영상 일시정지 후 재생하면 메트로놈 타이밍이 미묘하게 틀어짐
- **원인**: `play` 이벤트는 재생 요청 시점에 발생, 실제 재생 시작과 차이 존재
- **해결**: `playing` 이벤트 사용 (실제 재생 시작 후 발생)
- **파일**: `src/content/loops.ts:35`

### Bug 2: TAP Sync 초기 높은 점수
- **증상**: 2-3번 탭만으로도 높은 점수가 표시됨
- **원인**: 표본 수가 적을 때도 점수 계산
- **해결**: 최소 6회 탭 전까지 "--%" 표시
- **파일**: `src/content/ui-controller.ts`

## ✨ 새로운 기능

### Feature 1: 루프 Quantize
- **설명**: 루프 시작/끝을 가장 가까운 박에 스냅
- **사용법**: 루프 카드 메뉴 → Quantize
- **파일**: `src/content/index.ts`

### Feature 2: 루프별 Beat Sync 설정
- **설명**: 각 루프가 독립적인 BPM, 박자표, 오프셋 설정 가능
- **사용법**: 루프 카드 메뉴 → Beat Sync → "Use custom settings" 체크
- **파일**: `src/content/ui-controller.ts`

### Feature 3: TAP Sync 템포 정확도 점수
- **설명**: 일관성(70%) + 템포 정확도(30%) 가중치 적용
- **파일**: `src/content/ui-controller.ts`

## 💡 주요 인사이트

1. **offset 계산 기준**: 메트로놈 offset은 "영상 0초" 기준으로 계산됨. 루프 시작점(`start`)과는 무관. 이렇게 해야 같은 글로벌 설정을 사용하는 여러 루프가 일관된 타이밍을 유지함.

2. **루프 전환 시 동작**: A루프(custom) → B루프(global) 전환 시, B루프는 글로벌 offset 기준으로 메트로놈을 재계산함. A루프의 설정이 B루프에 영향을 주지 않음.

3. **YouTube 테마 감지**: `document.documentElement.hasAttribute('dark')`로 다크 모드 여부 확인 가능

## 🔜 다음 작업 제안

1. **우선순위 높음**: 실제 사용 테스트 및 버그 수정
2. **우선순위 중간**: 메트로놈 볼륨 UI 슬라이더 추가
3. **우선순위 낮음**: Beat Sync 설정 가져오기/내보내기

## 📝 메모

- Beat Sync 모달은 Shadow DOM 내부에 추가되어 YouTube 스타일과 격리됨
- CSS 변수를 사용하여 다크/라이트 테마 전환 구현
- 체크박스 라벨을 "Use global settings" → "Use custom settings"로 반전하여 직관성 향상

---

**커밋**: `feat: 루프별 Beat Sync 및 Quantize 기능 추가`
