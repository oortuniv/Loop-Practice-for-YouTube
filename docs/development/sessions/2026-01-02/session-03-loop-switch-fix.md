# Session 03: 루프 전환 버그 수정 및 Quantize 메뉴 조건부 표시

**날짜**: 2026-01-02
**작업자**: Claude Opus 4.5

## 세션 목표

1. [x] 메트로놈 ON 상태에서 타 루프 클릭 시 이전 루프로 점프하는 버그 수정
2. [x] 메트로놈 ON 상태에서 루프 전환 시 메트로놈이 멈추는 버그 수정
3. [x] Beat Sync 미완료 시 Quantize 메뉴 숨김 처리

## 수정된 파일

### 1. `src/content/loops.ts`

#### 변경사항
- `setProfile()`에서 `setLoopRange()` 즉시 호출 추가
- `resyncMetronomeIfRunning()` 메서드 추가

#### 핵심 코드

```typescript
// setProfile()에서 루프 범위 즉시 설정
if (profile.activeSegmentId) {
  const foundSegment = profile.segments.find(s => s.id === profile.activeSegmentId);
  this.active = foundSegment || undefined;

  if (this.active) {
    this.metronome.setLoopRange(this.active.start, this.active.end);
    // 주의: 여기서 resync()를 호출하면 안 됨
    // video.currentTime이 아직 이전 위치일 수 있음
  }
}

// 새 메서드
resyncMetronomeIfRunning(videoTime: number): void {
  if (this.metronome.isRunning()) {
    this.metronome.resync(videoTime);
  }
}
```

### 2. `src/content/index.ts`

#### 변경사항
- `jumpAndActivateSegment()`에서 video.currentTime 변경 후 resync 호출

#### 핵심 코드

```typescript
// 중요: 먼저 루프를 활성화하여 메트로놈 범위를 새 루프로 설정
this.activateSegment(segmentId);
this.video.currentTime = segment.start;

// 메트로놈이 실행 중이면 새 위치에서 resync (더블비트 방지)
if (this.loopController) {
  this.loopController.resyncMetronomeIfRunning(segment.start);
}
```

### 3. `src/content/ui-controller.ts`

#### 변경사항
- `isBeatSyncComplete()` 헬퍼 메서드 추가
- Quantize 메뉴 조건부 렌더링

#### 핵심 코드

```typescript
private isBeatSyncComplete(segment: LoopSegment): boolean {
  // 로컬 설정 사용 시
  if (segment.useGlobalSync === false) {
    const hasLocalTempo = typeof segment.localTempo === 'number' && segment.localTempo > 0;
    const hasLocalTimeSignature = typeof segment.localTimeSignature === 'string';
    const hasLocalOffset = typeof segment.localMetronomeOffset === 'number';
    return hasLocalTempo && hasLocalTimeSignature && hasLocalOffset;
  }

  // 글로벌 설정 사용 시
  if (!this.profile) return false;
  const hasGlobalTempo = typeof this.profile.tempo === 'number' && this.profile.tempo > 0;
  const hasGlobalTimeSignature = typeof this.profile.timeSignature === 'string';
  const hasGlobalOffset = typeof this.profile.globalMetronomeOffset === 'number';
  return hasGlobalTempo && hasGlobalTimeSignature && hasGlobalOffset;
}

// 메뉴 렌더링
${this.isBeatSyncComplete(segment) ? `<button ... data-action="quantize">Quantize</button>` : ''}
```

## 수정된 버그

### Bug 1: 루프 전환 시 이전 루프로 점프

- **증상**: 메트로놈 ON 상태에서 루프 B 클릭 시 루프 A 시작점으로 점프
- **원인**: 메트로놈 10ms 폴링이 이전 loopEnd를 기준으로 점프 감지
- **해결**: `setProfile()`에서 `setLoopRange()` 즉시 호출하여 새 루프 범위 설정
- **파일**: `src/content/loops.ts`

### Bug 2: 루프 전환 후 메트로놈 무음

- **증상**: 루프 전환 후 메트로놈 소리가 나지 않음
- **원인**: `resync()`가 이전 video.currentTime(17초)으로 호출되어 beatIndex가 새 루프 범위(0-14초) 밖으로 설정됨
- **해결**:
  1. `setProfile()`에서 `resync()` 제거 (video.currentTime이 아직 변경 전)
  2. `jumpAndActivateSegment()`에서 video.currentTime 변경 **후** `resyncMetronomeIfRunning()` 호출
- **파일**: `src/content/loops.ts`, `src/content/index.ts`

## 주요 인사이트

1. **타이밍 순서의 중요성**
   - `setLoopRange()`: video.currentTime 변경 **전**에 호출 (이전 루프 점프 방지)
   - `resync()`: video.currentTime 변경 **후**에 호출 (올바른 beatIndex 계산)

2. **두 가지 코드 경로**
   - `setProfile()`: profile 변경 시 호출 (video.currentTime은 아직 이전 값)
   - `setActive()`: 루프 활성화 시 호출 (video.currentTime과 함께 변경)

3. **Beat Sync 완료 조건**
   - BPM 설정 필수
   - 박자표 설정 필수
   - TAP Sync 오프셋 설정 필수 (첫 박 위치)

## 다음 작업 제안

1. **우선순위 높음**: 카운트인 기능 구현 (계획 파일 작성됨)
2. **우선순위 중간**: 디버깅 로그 정리

---

**커밋**: `fix: 루프 전환 버그 수정 및 Quantize 메뉴 조건부 표시`
