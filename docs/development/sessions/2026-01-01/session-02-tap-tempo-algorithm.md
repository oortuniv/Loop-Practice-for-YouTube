# Session 02: TAP Tempo 알고리즘 고도화

**날짜**: 2026-01-01
**작업자**: Claude Opus 4.5

## 📋 세션 목표

1. [x] 전문 DAW 프로그램의 TAP Tempo 알고리즘 조사
2. [x] TAP Tempo 기능 고도화 구현

## 🔍 조사 내용

### 전문 DAW들의 TAP Tempo 구현 방식

| DAW | 특징 |
|-----|------|
| **REAPER** | 이상치 자동 리셋 (평균에서 ±50% 벗어나면 새 템포로 인식) |
| **Logic Pro** | 가중치 평균 (최근 탭에 높은 가중치) |
| **Roland 하드웨어** | 마지막 4개 탭만 사용 |
| **Ableton Live** | 더블 클릭 필터 |

### 고급 알고리즘 요소
1. **더블 클릭 필터**: 50ms 이하 간격 무시
2. **가중치 평균**: 최근 탭에 높은 가중치 부여
3. **이상치 리셋**: 평균에서 크게 벗어나면 새 템포로 인식
4. **최소 신뢰 탭 수**: 일정 탭 수 이상이어야 BPM 표시 (미구현)

## 🔧 수정된 파일

### `src/content/ui-controller.ts`

#### `handleTapTempo()` 메서드 개선

```typescript
// 1. 더블 클릭 필터 (50ms 이하 무시)
if (this.tapTimes.length > 0) {
  const lastInterval = now - this.tapTimes[this.tapTimes.length - 1];
  if (lastInterval < 50) return;
}

// 2. 이상치 리셋 (REAPER 스타일 - ±50% 벗어나면 리셋)
if (this.tapTimes.length >= 2) {
  const lastInterval = now - this.tapTimes[this.tapTimes.length - 1];
  const currentAvgInterval = this.calculateCurrentAverageInterval();
  if (lastInterval < currentAvgInterval * 0.5 || lastInterval > currentAvgInterval * 1.5) {
    this.tapTimes = [];
  }
}

// 3. 가중치 평균 (최근 탭에 높은 가중치)
const weights = intervals.map((_, i) => i + 1);
const weightedSum = intervals.reduce((sum, interval, i) => sum + interval * weights[i], 0);
const totalWeight = weights.reduce((a, b) => a + b, 0);
const avgInterval = weightedSum / totalWeight;
```

#### 새로 추가된 헬퍼 메서드

```typescript
private calculateCurrentAverageInterval(): number {
  if (this.tapTimes.length < 2) return 0;
  const intervals: number[] = [];
  for (let i = 1; i < this.tapTimes.length; i++) {
    intervals.push(this.tapTimes[i] - this.tapTimes[i - 1]);
  }
  return intervals.reduce((a, b) => a + b, 0) / intervals.length;
}
```

## ✨ 개선된 기능

### TAP Tempo 알고리즘 고도화

| 기능 | 설명 | 효과 |
|------|------|------|
| 더블 클릭 필터 | 50ms 이하 간격 무시 | 실수로 인한 더블 클릭 방지 |
| 가중치 평균 | 최근 탭에 높은 가중치 | 템포 변화에 빠르게 반응 |
| 이상치 리셋 | ±50% 벗어나면 리셋 | 새 템포로 자연스럽게 전환 |

## 📊 테스트 결과

### ✅ 성공한 테스트
- [x] 빠른 더블 클릭 시 무시됨
- [x] 템포 크게 변경 시 자동 리셋 후 새 템포 인식
- [x] 안정적인 탭 시 정확한 BPM 계산
- [x] 최근 탭에 더 높은 가중치 부여됨

## 💡 주요 인사이트

1. **REAPER 스타일 이상치 리셋**: 사용자가 템포를 바꿀 때 별도 동작 없이 자연스럽게 새 템포 인식
2. **가중치 평균의 효과**: 처음 몇 탭이 부정확해도 이후 탭으로 빠르게 수정됨
3. **50ms 더블 클릭 필터**: 사람이 의도적으로 50ms 이하로 탭하기 어려우므로 안전한 임계값

---

**세션 종료 시각**: 2026-01-01
**커밋**: `4c176cc` - feat: TAP Tempo 알고리즘 고도화
