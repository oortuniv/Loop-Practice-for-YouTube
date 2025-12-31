# 배포 자동화 가이드

## 📋 개요

이 프로젝트는 GitHub Actions를 통한 자동 빌드 시스템을 사용합니다.

**두 가지 배포 방식**:
1. **태그 기반 배포**: GitHub Release 자동 생성 (공식 릴리스용)
2. **main 브랜치 배포**: 빌드 아티팩트 생성 (테스트용)

---

## 🚀 일반적인 배포 프로세스 (추천)

### 1. 개발 및 커밋

```bash
# main 브랜치에서 작업
git checkout main

# 코드 수정
# ...

# 커밋
git add .
git commit -m "feat: add new feature"
git push origin main
```

**팁**: 큰 기능 개발 시에는 feature 브랜치 사용
```bash
git checkout -b feature/new-thing
# ... 개발 ...
git checkout main
git merge feature/new-thing
git push origin main
```

### 2. 배포 준비 (Chrome Web Store 제출 시)

```bash
# 1. 버전 업데이트 (자동으로 태그도 생성됨)
npm version patch  # 0.1.0 → 0.1.1 (버그 수정)
npm version minor  # 0.1.1 → 0.2.0 (새 기능)
npm version major  # 0.2.0 → 1.0.0 (큰 변경)

# 2. 태그 푸시
git push --follow-tags

# 3. GitHub Actions가 자동으로 빌드 및 Release 생성 (2-3분 소요)
```

### 3. Chrome Web Store 업로드

1. [GitHub Releases](../../releases)에서 ZIP 다운로드
2. [Chrome Web Store Dashboard](https://chrome.google.com/webstore/devconsole) 접속
3. "패키지 업로드" → ZIP 선택 → "제출"

---

## 🔄 빠른 테스트 (태그 없이 빌드만)

```bash
# main에 푸시하면 자동 빌드
git push origin main

# Actions 탭에서 Artifacts 다운로드
# (30일간 보관)
```

---

## 🌿 브랜치 전략

### main 브랜치만 사용 (간단)

```
main
  └── 모든 작업을 여기서
```

**사용 예**:
```bash
# 일상적인 개발
git checkout main
# ... 수정 ...
git commit -m "fix: typo"
git push origin main
```

### main + feature 브랜치 (권장)

```
main (안정 버전)
  └── feature/* (큰 기능 개발 시)
```

**사용 예**:
```bash
# 작은 수정 → main에 직접
git checkout main
git commit -m "fix: typo"
git push

# 큰 기능 → feature 브랜치
git checkout -b feature/premium
# ... 개발 ...
git checkout main
git merge feature/premium
git push
```

**규칙**:
- ✅ 버그 수정, 문서 수정 → main에 직접
- ✅ 새 기능, 실험적 코드 → feature 브랜치
- ❌ develop 브랜치 사용 안 함 (개인 프로젝트에서 불필요)

---

## 🔧 버전 관리

### npm version 사용 (권장)

```bash
# package.json 버전 업데이트 + Git 태그 생성 + 커밋
npm version patch  # 0.1.0 → 0.1.1
```

이 명령어는 자동으로:
1. ✅ package.json 버전 업데이트
2. ✅ Git 커밋 생성
3. ✅ Git 태그 생성 (v0.1.1)

### manifest.ts는 어떻게?

GitHub Actions가 빌드 시 자동으로 동기화합니다:

```
package.json (version: "0.1.1")
    ↓
GitHub Actions 빌드
    ↓
manifest.ts 자동 업데이트
    ↓
dist/manifest.json (version: "0.1.1")
```

**로컬에서는 package.json만 관리하면 됩니다!**

### 버전 규칙

```bash
# Patch (0.1.0 → 0.1.1): 버그 수정, 작은 개선
npm version patch

# Minor (0.1.0 → 0.2.0): 새 기능, 하위 호환
npm version minor

# Major (0.1.0 → 1.0.0): 큰 변경, 하위 호환 깨짐
npm version major
```

---

## 📦 빌드 아티팩트

### GitHub Release (태그 푸시 시)
- **위치**: [Releases 페이지](../../releases)
- **보관**: 영구
- **용도**: Chrome Web Store 제출용

### GitHub Artifacts (main 푸시 시)
- **위치**: [Actions 탭](../../actions) → 워크플로우 선택
- **보관**: 30일
- **용도**: 테스트/검증용

---

## 🚨 문제 해결

### Q: 빌드가 실행되지 않아요
- `.github/workflows/` 파일이 main 브랜치에 있는지 확인
- Actions 탭에서 워크플로우가 활성화되어 있는지 확인
- 문서 파일(*.md)만 수정한 경우 빌드 스킵됨 (정상)

### Q: 태그를 잘못 만들었어요
```bash
# 로컬 태그 삭제
git tag -d v0.1.1

# 원격 태그 삭제
git push origin :refs/tags/v0.1.1

# 다시 생성
npm version 0.1.1
git push --follow-tags
```

### Q: 수동으로 빌드하고 싶어요
```bash
npm run build
cd dist
zip -r ../my-build.zip .
```

---

## 📚 요약

### 일반적인 워크플로우

```bash
# 1. 개발
git checkout main
# ... 코드 수정 ...
git add .
git commit -m "feat: new feature"
git push origin main

# 2. 테스트 빌드 확인 (선택)
# → Actions 탭에서 Artifacts 다운로드

# 3. 배포 준비
npm version minor  # 버전 업데이트
git push --follow-tags

# 4. Release 다운로드 → Chrome Web Store 업로드
```

### 핵심 포인트

- ✅ main 브랜치에서 직접 작업 (또는 필요시 feature 브랜치)
- ✅ `npm version`으로 버전 관리
- ✅ 태그 푸시하면 자동 Release 생성
- ✅ manifest.ts는 자동 동기화됨
- ✅ develop 브랜치 불필요

---

**마지막 업데이트**: 2025-12-31
