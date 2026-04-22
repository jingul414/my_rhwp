# oh-my-han-word

[rhwp](https://github.com/edwardkim/rhwp) 프로젝트를 기반으로 한 **데비안 계열 리눅스용 HWP/HWPX 문서 뷰어/편집기**입니다.

Tauri를 이용해 단독 실행형 데스크탑 앱(.deb)으로 패키징하며, GitHub Actions를 통해 자동 빌드 및 릴리즈됩니다.

## 특징

- **HWP / HWPX 파일 열기 및 편집** — rhwp 라이브러리 기반
- **단독 실행형** — 별도 서버나 브라우저 불필요
- **자동 빌드** — upstream rhwp 업데이트 시 자동으로 새 .deb 릴리즈
- **경량** — WebAssembly 기반 렌더링

## 설치

[Releases](../../releases) 페이지에서 최신 `.deb` 파일을 다운로드 후 설치합니다.

```bash
sudo dpkg -i rhwp-desktop_*.deb
```

## 빌드 구조

```
oh-my-han-word/
├── src-tauri/          # Tauri 백엔드 (Rust) — 파일 I/O, OS 연동
├── src-rhwp/           # rhwp 서브모듈 (upstream: edwardkim/rhwp)
│   ├── src/            # Rust 소스 (HWP 파서/렌더러)
│   ├── pkg/            # wasm-pack 빌드 출력 (WASM + JS 바인딩)
│   └── rhwp-studio/    # 웹 프론트엔드 (Tauri WebView에서 실행)
└── .github/workflows/
    ├── build.yml           # Tauri 앱 빌드 → .deb 릴리즈
    └── check-upstream.yml  # rhwp 업스트림 변경 감지 → 자동 빌드 트리거
```

## 라이선스

MIT — 단, 서브모듈 [rhwp](https://github.com/edwardkim/rhwp)는 해당 프로젝트의 라이선스를 따릅니다.
