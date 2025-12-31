# Session 01: Deployment Automation and Licensing

**날짜**: 2025-12-31
**담당**: Claude Sonnet 4.5
**상태**: 완료

## 📋 세션 목표

1. Chrome Extension 배포 자동화 구축
2. 라이선스 전략 수립 및 변경
3. 브랜치 전략 간소화
4. Git 저장소 정리

---

## ✅ 완료된 작업

### 1. GitHub Actions 배포 자동화

#### 생성된 파일
- `.github/workflows/build-on-tag.yml` - 태그 기반 자동 빌드 및 Release 생성
- `.github/workflows/build-on-main.yml` - main 푸시 시 Artifacts 생성

#### 주요 기능
- **태그 기반 배포**:
  - `npm version patch/minor/major` 실행
  - `git push --follow-tags` 시 자동 빌드
  - GitHub Release 자동 생성
  - manifest.ts 버전 자동 동기화

- **main 브랜치 배포**:
  - main 푸시 시 자동 빌드
  - Artifacts로 ZIP 생성 (30일 보관)
  - GitHub Step Summary 출력

#### 해결한 이슈
- ❌ 권한 에러 (403): `permissions: contents: write` 추가
- ❌ 커밋 댓글 에러: `GITHUB_STEP_SUMMARY` 사용으로 변경

### 2. 라이선스 변경

#### 변경 내용
**Before**: MIT License (오픈소스)
**After**: Proprietary License (독점)

#### 수정된 파일
- `LICENSE`: MIT → All Rights Reserved
- `README.md`: 라이선스 섹션 업데이트
- `package.json`: `"license": "UNLICENSED"`, `"private": true` 추가

#### 배경 및 결정 사항
- 상업적 결제 기능 추가 계획
- MIT License는 복제/재배포 방지 불가
- Public Repo + Proprietary License = 신뢰도 + 법적 보호
- Chrome Web Store 심사 편의성 유지

### 3. Chrome Web Store 설명 수정

#### 생성된 파일
- `docs/CHROME_STORE_DESCRIPTION.md`

#### 제거한 내용
- ❌ "Open source - transparent code you can review"
- ❌ "Join thousands of musicians" (과장된 표현)

### 4. Git 저장소 정리

#### `.gitignore` 업데이트
```
node_modules/
dist/
downloads/
*.zip
.DS_Store
```

#### Git 추적 제거
- `dist/` 폴더 및 빌드 결과물
- `.DS_Store` (macOS 시스템 파일)
- `*.zip` 파일들

### 5. 브랜치 전략 간소화

#### Before (과도함)
```
main (production)
  └── develop (개발/테스트)
       └── feature/* (선택사항)
```

#### After (개인 개발자용)
```
main (안정 버전)
  └── feature/* (큰 기능 개발 시)
```

#### 규칙
- 작은 수정/버그 → main에 직접 커밋
- 새 기능/실험 → feature 브랜치
- develop 브랜치 사용 안 함

### 6. 문서화

#### 생성/수정된 문서
- `docs/DEPLOYMENT.md` - 배포 자동화 가이드 (간소화됨)
- `docs/CHROME_STORE_DESCRIPTION.md` - 스토어 설명 백업

---

## 🔧 기술적 세부사항

### 배포 워크플로우

**태그 기반**:
```bash
npm version patch    # package.json 버전 업데이트 + 태그 생성
git push --follow-tags
# → GitHub Actions 트리거
# → manifest.ts 버전 동기화
# → 빌드 실행
# → GitHub Release 생성
```

**main 푸시**:
```bash
git push origin main
# → GitHub Actions 트리거
# → 빌드 실행
# → Artifacts 업로드 (30일 보관)
```

### 버전 관리 전략

- **도구**: `npm version` 사용 (jq 불필요)
- **동기화**: GitHub Actions가 package.json → manifest.ts 자동 반영
- **장점**:
  - 표준 npm 명령어
  - Git 태그 자동 생성
  - 실수 방지

### manifest.ts 버전 동기화

```yaml
# build-on-tag.yml
- name: Update manifest version
  run: |
    sed -i 's/version: "[^"]*"/version: "${{ steps.get_version.outputs.VERSION }}"/' src/manifest.ts
```

---

## 💡 주요 결정 및 인사이트

### 1. Public Repo vs Private Repo

**결정**: Public Repo 유지

**이유**:
- Chrome Web Store 심사 시 소스코드 매번 제출 불필요
- 사용자 신뢰도 증가
- 포트폴리오 활용 가능
- Proprietary License로 법적 보호됨

### 2. MIT License의 문제점

**문제**:
- 누구나 코드 복제/재배포 가능
- 유료 기능 무료화 가능
- 상업적 보호 불가

**해결**:
- Proprietary License로 변경
- 코드 공개 ≠ 자유 사용
- 법적 보호 확보

### 3. 브랜치 전략 단순화

**배경**:
- 개인 개발자에게 develop 브랜치 불필요
- 통합 테스트할 다른 개발자 없음
- 복잡성만 증가

**효과**:
- 워크플로우 간소화
- 작업 속도 증가
- 혼란 감소

### 4. npm version vs jq

**비교**:
| 도구 | 장점 | 단점 |
|------|------|------|
| `npm version` | 표준, 간단, 태그 자동 생성 | - |
| `jq` | 프로그래밍 가능 | 추가 설치, 복잡 |

**결정**: `npm version` 사용

---

## 🚨 알려진 이슈 및 주의사항

### 1. privacy.html 삭제 금지
- Chrome Web Store에 제출한 Privacy Policy URL
- 삭제 시 정책 위반으로 확장 거부 가능
- GitHub Pages로 공개됨

### 2. store-assets 유지
- 아이콘, 스크린샷 등 필수 에셋
- 크기 작음 (240KB)
- 버전 관리 필요

### 3. 매 업데이트 시 소스코드 제출

**Private Repo 사용 시**:
- 매번 소스 ZIP 제출 필요
- 빌드 방법 설명 필요
- 심사 시간 증가

**Public Repo (현재)**:
- GitHub URL 한 번만 제공
- 자동 검증
- 빠른 심사

---

## 📦 배포 프로세스 요약

### 일반적인 워크플로우

```bash
# 1. 개발
git checkout main
# ... 코드 수정 ...
git commit -m "feat: new feature"
git push origin main

# 2. 테스트 빌드 확인 (선택)
# → GitHub Actions → Artifacts 다운로드

# 3. 배포 준비
npm version minor
git push --follow-tags

# 4. Release 다운로드 → Chrome Web Store 업로드
```

---

## 🔜 다음 작업 제안

### 즉시 할 일
1. Chrome Web Store에서 제품 설명 업데이트
   - "Open source" 표현 제거
   - docs/CHROME_STORE_DESCRIPTION.md 내용으로 교체

2. 현재 변경사항 커밋
   ```bash
   git add .
   git commit -m "chore: setup CI/CD, update license, simplify workflow"
   git push origin main
   ```

### 향후 계획
1. **유료 기능 설계**
   - 클라이언트 vs 서버 측 구현 결정
   - Hybrid 전략 고려 (기본 기능 오픈, 프리미엄 서버 API)

2. **아이콘 및 스크린샷 제작**
   - store-assets/icons/ 준비
   - store-assets/screenshots/ 제작
   - Chrome Web Store 업데이트

3. **기능 개선**
   - 사용자 피드백 수집
   - 버그 수정
   - 새 기능 추가

---

## 📚 참고 자료

- [GitHub Actions 문서](https://docs.github.com/en/actions)
- [npm version 문서](https://docs.npmjs.com/cli/v9/commands/npm-version)
- [Chrome Web Store 개발자 가이드](https://developer.chrome.com/docs/webstore/)
- [참고 블로그](https://23life.tistory.com/entry/StepBy%EC%97%90%EC%84%9C-%ED%81%AC%EB%A1%AC-%EC%9D%B5%EC%8A%A4%ED%85%90%EC%85%98-%EB%B0%B0%ED%8F%AC-%EA%B3%BC%EC%A0%95%EC%9D%84-%EC%9E%90%EB%8F%99%ED%99%94%ED%95%9C-%EB%B0%A9%EB%B2%95)

---

## 📝 메모

- 배포 자동화 완료 및 v0.1.0 Release 테스트 성공
- 라이선스 변경으로 상업적 보호 확보
- 개인 개발자에 맞는 간소화된 워크플로우 구축
- 문서화 완료

**다음 세션 시작 시**:
1. 이 파일 읽고 컨텍스트 파악
2. Chrome Web Store 스토어 설명 업데이트 확인
3. 첫 배포 후 사용자 피드백 확인

---

**세션 종료**: 2025-12-31
