# Session 02: 루프 재시작 시 더블비트 문제 해결

**날짜**: 2026-01-02
**작업자**: Claude Opus 4.5

## 📋 세션 목표

이번 세션에서 달성하려는 목표:

1. [x] 루프 재시작 시 더블비트(중복 박) 문제 해결
2. [x] RAF 기반 루프 감지를 메트로놈 기반으로 변경

## 🔧 수정된 파일

### 1. `src/content/audio/metronome.ts`

#### 변경사항
- `loopEnd`, `loopStart` 프로퍼티 추가 (루프 범위 저장)
- `onLoopJumpRequest` 콜백 추가 (loopEnd 도달 시 호출)
- `setLoopRange()`, `clearLoopRange()` 메서드 추가
- `setOnLoopJumpRequest()` 메서드 추가
- `resync()` 메서드 개선: 이미 지나간 박 스킵 로직 추가
- `lookAheadScheduler()` 수정: EPSILON 비교 및 루프 점프 감지

#### 핵심 코드

```typescript
// resync(): 이미 지나간 박 스킵
resync(videoTime: number): void {
  const currentBeatTime = this.metronomeOffset + (currentBeatIndex * beatDuration);

  if (videoTime > currentBeatTime + 0.01) {
    // 현재 박은 이미 지남 → 다음 박부터 스케줄
    this.lastScheduledBeatIndex = currentBeatIndex;
  } else {
    // 현재 박이 아직 안 지남 → 현재 박 스케줄
    this.lastScheduledBeatIndex = currentBeatIndex - 1;
  }
}
```

**변경 이유**: 루프 점프 직후 `resync()` 호출 시, 비디오 시간이 이미 박 시간을 지났으면 그 박을 스케줄하지 않음

### 2. `src/content/loops.ts`

#### 변경사항
- `isJumping` 플래그 추가 (루프 점프 중 여부)
- `handleLoopJump()` 메서드 추가
- `setActive()` 수정: RAF 메서드 대신 `setLoopRange()` 사용
- `playing` 이벤트 핸들러 수정: `isJumping`, `isRunning()` 체크 추가
- `dispose()` 수정: `clearLoopRange()` 호출

#### 핵심 코드

```typescript
// playing 이벤트에서 중복 시작 방지
this.video.addEventListener('playing', () => {
  if (this.isJumping) return;  // 루프 점프 중 무시
  if (this.metronome.isRunning()) return;  // 이미 실행 중 무시
  // ... 메트로놈 시작
});

// 루프 점프 처리
private handleLoopJump(start: number): void {
  if (this.isJumping) return;
  this.isJumping = true;
  this.video.currentTime = start;
  this.metronome.resync(start);
  requestAnimationFrame(() => { this.isJumping = false; });
}
```

**변경 이유**:
- `video.currentTime` 변경 시 `playing` 이벤트가 발생하여 메트로놈이 재시작되는 문제 방지
- 루프 점프 직후 과거 박이 스케줄되는 문제 방지

### 3. `src/content/index.ts`

#### 변경사항
- 카운트인 관련 코드 임시 비활성화 (주석 처리)

## 🐛 수정된 버그

### Bug 1: 루프 재시작 시 더블비트

- **증상**: 루프가 끝에서 시작으로 점프할 때 같은 박이 두 번 재생됨
- **원인 1**: `video.currentTime` 변경이 `playing` 이벤트를 트리거하여 메트로놈 재시작
- **원인 2**: `resync()` 후 이미 지나간 박(예: 5.153s)이 현재 시간(5.202s)보다 과거임에도 스케줄됨
- **해결**:
  1. `isJumping` 플래그로 루프 점프 중 `playing` 이벤트 무시
  2. `metronome.isRunning()` 체크로 중복 시작 방지
  3. `resync()`에서 `videoTime > currentBeatTime + 0.01` 시 현재 박 스킵
- **파일**: `src/content/loops.ts`, `src/content/audio/metronome.ts`

### Bug 2: RAF 기반 루프 감지 지연

- **증상**: loopEnd 감지가 느려서 영상이 루프 끝을 지나치는 경우 발생
- **원인**: RAF는 ~16ms 간격으로 실행되어 정밀한 타이밍 감지 불가
- **해결**: 메트로놈의 10ms 폴링 루프에서 loopEnd 감지
- **파일**: `src/content/audio/metronome.ts`

## 💡 주요 인사이트

1. **Look-ahead 스케줄링의 한계**: AudioContext에 한 번 스케줄된 오디오는 취소할 수 없음. 따라서 루프 점프 시점을 미리 예측하여 점프 후 박이 스케줄되지 않도록 해야 함.

2. **YouTube의 `playing` 이벤트 특성**: `video.currentTime`을 변경하면 `playing` 이벤트가 다시 발생함. 이를 고려하지 않으면 의도치 않은 메트로놈 재시작 발생.

3. **부동소수점 비교**: 시간 비교 시 EPSILON(1ms)을 사용해야 양자화된 시간 값의 미세한 오차를 처리할 수 있음.

4. **디버깅 로그의 중요성**: `[Metronome] SCHEDULE`, `resync` 로그를 추가하여 문제의 정확한 원인(과거 박 스케줄링)을 식별할 수 있었음.

## 🔜 다음 작업 제안

1. **우선순위 높음**: 디버깅 로그 정리 (console.log 제거 또는 조건부 출력)
2. **우선순위 중간**: 카운트인 기능 재활성화 및 테스트
3. **우선순위 낮음**: 메트로놈 볼륨 UI 슬라이더 추가

## 📝 메모

### 더블비트 발생 흐름 (수정 전)

```
1. beat 24 (13.153s) 스케줄됨
2. loopEnd (13.202s) 도달 감지
3. video.currentTime = loopStart (5.202s) 설정
4. playing 이벤트 발생 → startGlobalSyncMetronome() 호출
5. 메트로놈 재시작 → resync(5.202s)
6. beat 8 (5.153s) 스케줄됨 ← 문제! 이미 지난 시간
7. beat 24와 beat 8이 둘 다 재생 → 더블비트
```

### 더블비트 방지 흐름 (수정 후)

```
1. beat 24 (13.153s) 스케줄됨
2. loopEnd (13.202s) 도달 감지
3. handleLoopJump() 호출 → isJumping = true
4. video.currentTime = loopStart (5.202s) 설정
5. metronome.resync(5.202s) 호출
   - currentBeatTime = 5.153s < videoTime = 5.202s
   - → lastScheduledBeatIndex = 8 (스킵)
6. playing 이벤트 발생 → isJumping이므로 무시
7. 다음 폴링에서 beat 9 (5.653s) 스케줄됨
8. 더블비트 없음 ✓
```

---

**커밋**: `fix: 루프 재시작 시 더블비트 문제 해결`
