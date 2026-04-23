(function () {
  if (typeof window.__TAURI__ === 'undefined') return;

  var invoke = window.__TAURI__.core.invoke;

  // 현재 열린 파일의 경로 (저장 시 덮어쓰기에 사용)
  var currentFilePath = null;
  // 다른 이름으로 저장 시 true로 설정
  var forceSaveAs = false;

  async function loadAndSendFile(result) {
    currentFilePath = result.file_path;

    var binary = atob(result.data_b64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    window.postMessage(
      {
        type: 'rhwp-request',
        id: Date.now(),
        method: 'loadFile',
        params: { data: bytes, fileName: result.file_name },
      },
      '*'
    );

    try {
      var getCurrentWindow = window.__TAURI__.window.getCurrentWindow;
      if (getCurrentWindow) {
        await getCurrentWindow().setTitle('RHWP Desktop — ' + result.file_name);
      }
    } catch (_) {}
  }

  async function updateTitleAfterSave(path) {
    var name = path.split('/').pop();
    try {
      var getCurrentWindow = window.__TAURI__.window.getCurrentWindow;
      if (getCurrentWindow) {
        await getCurrentWindow().setTitle('RHWP Desktop — ' + name);
      }
    } catch (_) {}
  }

  // HWP 다운로드 가로채기: rhwp-studio의 blob 다운로드를 네이티브 저장으로 전환
  var originalAnchorClick = HTMLAnchorElement.prototype.click;
  HTMLAsmElement_prototype_click: {
    HTMLAnchorElement.prototype.click = function () {
      var a = this;
      if (
        a.download &&
        /\.(hwp|hwpx)$/i.test(a.download) &&
        a.href &&
        a.href.startsWith('blob:')
      ) {
        var blobUrl = a.href;
        var fileName = a.download;
        var isSaveAs = forceSaveAs;
        forceSaveAs = false;

        (async function () {
          try {
            // blob URL에서 bytes 추출
            var response = await fetch(blobUrl);
            var blob = await response.blob();
            var b64 = await new Promise(function (resolve, reject) {
              var reader = new FileReader();
              reader.onload = function () { resolve(reader.result.split(',')[1]); };
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });

            var targetPath;
            if (!isSaveAs && currentFilePath) {
              targetPath = currentFilePath;
            } else {
              targetPath = await invoke('pick_save_path', { fileName: fileName });
              if (!targetPath) return;
            }

            await invoke('save_file', { path: targetPath, dataB64: b64 });
            currentFilePath = targetPath;
            await updateTitleAfterSave(targetPath);
          } catch (e) {
            console.error('[tauri-bridge] 저장 실패:', e);
            alert('저장에 실패했습니다:\n' + e.message);
          }
        })();
        return; // 브라우저 다운로드 방지
      }
      originalAnchorClick.call(this);
    };
  }

  async function openWithTauri() {
    try {
      var result = await invoke('pick_hwp_file');
      if (!result) return;
      invoke('add_recent_file', { path: result.file_path, name: result.file_name });
      await loadAndSendFile(result);
    } catch (e) {
      console.error('[tauri-bridge] 파일 열기 실패:', e);
    }
  }

  async function openRecentFile(path) {
    try {
      var result = await invoke('open_recent_file', { path: path });
      if (!result) {
        alert('파일을 찾을 수 없습니다:\n' + path);
        return;
      }
      invoke('add_recent_file', { path: result.file_path, name: result.file_name });
      await loadAndSendFile(result);
    } catch (e) {
      console.error('[tauri-bridge] 최근 파일 열기 실패:', e);
    }
  }

  async function refreshRecentMenu() {
    var dropdown = document.querySelector('[data-menu="file"] .menu-dropdown');
    if (!dropdown) return;

    // 기존 주입 항목 제거
    dropdown.querySelectorAll('.rhwp-injected').forEach(function (el) { el.remove(); });

    // "다른 이름으로 저장" 주입 (file:save 바로 뒤)
    var saveItem = dropdown.querySelector('[data-cmd="file:save"]');
    if (saveItem) {
      var saveAsItem = document.createElement('div');
      saveAsItem.className = 'md-item rhwp-injected';
      if (saveItem.classList.contains('disabled')) {
        saveAsItem.classList.add('disabled');
      }

      var saIcon = document.createElement('span');
      saIcon.className = 'md-icon';
      var saLabel = document.createElement('span');
      saLabel.className = 'md-label';
      saLabel.textContent = '다른 이름으로 저장';
      saveAsItem.appendChild(saIcon);
      saveAsItem.appendChild(saLabel);

      saveAsItem.addEventListener('click', function (e) {
        e.stopPropagation();
        // 메뉴 직접 닫기
        var fileMenuItem = document.querySelector('[data-menu="file"]');
        if (fileMenuItem) fileMenuItem.classList.remove('open');

        var saveCmdEl = document.querySelector('[data-cmd="file:save"]');
        if (!saveCmdEl || saveCmdEl.classList.contains('disabled')) return;

        forceSaveAs = true;
        saveCmdEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      saveItem.insertAdjacentElement('afterend', saveAsItem);
    }

    // 최근 파일 목록 주입
    var files = await invoke('get_recent_files');
    if (!files || files.length === 0) return;

    var sep = document.createElement('div');
    sep.className = 'md-sep rhwp-injected';
    dropdown.appendChild(sep);

    files.forEach(function (file) {
      var item = document.createElement('div');
      item.className = 'md-item rhwp-injected';
      item.title = file.path;

      var icon = document.createElement('span');
      icon.className = 'md-icon';
      var label = document.createElement('span');
      label.className = 'md-label';
      label.textContent = file.name;

      item.appendChild(icon);
      item.appendChild(label);

      item.addEventListener('click', function () {
        openRecentFile(file.path);
      });

      dropdown.appendChild(item);
    });
  }

  // 드래그 앤 드롭으로 파일 열기
  window.__TAURI__.event.listen('tauri://drag-drop', async function (event) {
    var paths = event.payload.paths;
    if (!paths || paths.length === 0) return;
    var hwpPath = paths.find(function (p) { return /\.(hwp|hwpx)$/i.test(p); });
    if (!hwpPath) return;
    try {
      var result = await invoke('open_recent_file', { path: hwpPath });
      if (!result) return;
      invoke('add_recent_file', { path: result.file_path, name: result.file_name });
      await loadAndSendFile(result);
    } catch (e) {
      console.error('[tauri-bridge] 드래그 앤 드롭 열기 실패:', e);
    }
  });

  async function checkStartupFile() {
    try {
      var path = await invoke('get_startup_file');
      if (!path) return;
      setTimeout(async function () {
        var result = await invoke('open_recent_file', { path: path });
        if (!result) return;
        invoke('add_recent_file', { path: result.file_path, name: result.file_name });
        await loadAndSendFile(result);
      }, 2000);
    } catch (e) {
      console.error('[tauri-bridge] 시작 파일 열기 실패:', e);
    }
  }

  function patchFileInput() {
    var input = document.getElementById('file-input');
    if (input) input.click = openWithTauri;
    checkStartupFile();

    // 새 문서 생성 시 currentFilePath 초기화
    var newDocItem = document.querySelector('[data-cmd="file:new-doc"]');
    if (newDocItem) {
      newDocItem.addEventListener('click', function () {
        currentFilePath = null;
      });
    }

    // 파일 메뉴가 열릴 때마다 항목 갱신
    var fileMenuItem = document.querySelector('[data-menu="file"]');
    if (fileMenuItem) {
      new MutationObserver(function (mutations) {
        mutations.forEach(function (m) {
          if (m.attributeName === 'class' && fileMenuItem.classList.contains('open')) {
            refreshRecentMenu();
          }
        });
      }).observe(fileMenuItem, { attributes: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchFileInput);
  } else {
    patchFileInput();
  }
})();
