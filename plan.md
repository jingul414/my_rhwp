# RHWP Desktop 구현 계획

## 현재 상태
- Tauri + rhwp-studio(WASM) 빌드 파이프라인 완성 ✅
- GitHub Actions → .deb 자동 빌드/릴리즈 ✅
- upstream rhwp 변경 감지 → 자동 빌드 트리거 ✅

---

## Phase 1 — Tauri 네이티브 연결

### ~~1-1. 파일 열기: 네이티브 OS 다이얼로그 연결~~
- ~~`tauri-plugin-dialog` 추가 (Cargo.toml + capabilities)~~
- ~~`src-tauri/src/lib.rs`에 `open_file` 커맨드 구현~~
  - ~~Tauri 파일 다이얼로그 → 파일 bytes 읽어서 반환~~
- ~~rhwp-studio `file:open` 커맨드에서 Tauri IPC 호출로 교체~~
  - ~~`src-rhwp`는 서브모듈이므로 직접 수정 불가~~
  - ~~rhwp-studio의 `file:open` 커맨드를 오버라이드하는 패치 스크립트 또는 Tauri `__TAURI__` 환경 감지 방식 사용~~

### ~~1-2. 창 제목 파일명 표시~~
- ~~파일 열릴 때 `appWindow.setTitle("RHWP Desktop — 파일명.hwp")` 호출~~

---

## Phase 2 — UX 개선

### ~~2-1. 최근 파일 목록~~
- ~~`tauri-plugin-store`로 최근 파일 경로 로컬 저장~~ (앱 데이터 디렉토리 JSON으로 구현)
- ~~앱 시작 시 "최근 파일" 목록 표시~~ (파일 메뉴 열릴 때 동적 주입)

### ~~2-2. 드래그 앤 드롭으로 파일 열기~~
- ~~Tauri `drag-drop` 이벤트로 파일 경로 수신~~
- ~~rhwp-studio에 bytes 전달~~

### ~~2-3. 앱 아이콘 교체~~
- ~~`src-tauri/icons/`에 rhwp 로고 적용 (`src-rhwp/assets/logo/` 활용)~~

---

## Phase 3 — 추가 기능

### 3-1. PDF 내보내기
- ⚠️ rhwp PDF 지원은 v2.0 예정 — 현재 구현 불가, 보류
- rhwp v2.0 이후 WASM PDF API 확인 후 재검토

### ~~3-2. 파일 연결 + CLI 파일 인수 (더블클릭으로 열기)~~
- ~~`.hwp`, `.hwpx` 파일을 시스템에 앱으로 등록~~
- ~~`tauri.conf.json` `fileAssociations` 설정~~
- ~~CLI 인수(`rhwp-desktop file.hwp`)로 파일 열기 구현 필요 (파일 연결 동작의 전제 조건)~~
- ~~MIME 타입 등록 (.deb 패키지에 포함)~~

### ~~3-3. 네이티브 저장 다이얼로그~~
- ~~rhwp-studio의 `file:save`는 WebKit에서 File System Access API 미지원으로 브라우저 다운로드 폴백~~
- ~~blob 다운로드 가로채기로 네이티브 저장 구현~~
- ~~저장: 원본 경로 덮어쓰기 (temp→rename 원자적 방식)~~
- ~~다른 이름으로 저장: 주입 메뉴 항목 + Tauri 네이티브 save 다이얼로그~~

---

## 빌드 시간 최적화

현재 병목: wasm-pack이 매번 rhwp 전체를 WASM으로 재컴파일 (수십 분 소요)

### O-1. WASM pkg 캐시 — 적용완료
`src-rhwp/pkg/`를 소스 파일 해시로 캐시.
rhwp Rust 소스가 바뀌지 않으면 wasm-pack 빌드를 완전히 건너뜀.

```yaml
- uses: actions/cache@v4
  id: wasm-cache
  with:
    path: src-rhwp/pkg
    key: wasm-${{ hashFiles('src-rhwp/src/**', 'src-rhwp/Cargo.toml') }}

- name: wasm-pack 빌드 (캐시 미스 시만)
  if: steps.wasm-cache.outputs.cache-hit != 'true'
  run: wasm-pack build src-rhwp --target web
```

### O-2. Rust 컴파일 캐시 범위 확장 — O-1 적용시 효과 미비로 적용 x
`Swatinem/rust-cache`의 workspaces에 `src-rhwp` 추가.
WASM 캐시 미스 시 wasm32 타겟 중간 산출물을 재사용.

```yaml
- uses: Swatinem/rust-cache@v2
  with:
    workspaces: |
      src-tauri
      src-rhwp
```

### O-3. rhwp-studio node_modules 캐시 — 예정?
package.json이 바뀌지 않으면 npm install 건너뜀.

```yaml
- uses: actions/cache@v4
  with:
    path: src-rhwp/rhwp-studio/node_modules
    key: studio-npm-${{ hashFiles('src-rhwp/rhwp-studio/package.json') }}
```

---

## 기술 메모

| 항목 | 내용 |
|------|------|
| 프론트엔드 | `src-rhwp/rhwp-studio` (서브모듈, 직접 수정 불가) |
| WASM 빌드 | `wasm-pack build src-rhwp --target web` → `src-rhwp/pkg/` |
| Tauri 백엔드 역할 | 파일 I/O, OS 다이얼로그, 창 제목 — 렌더링은 전부 WASM |
| rhwp-studio 패치 방법 | `__TAURI__` 전역 감지 후 IPC 분기 (서브모듈 수정 없이) |
