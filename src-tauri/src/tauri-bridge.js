(function () {
  if (typeof window.__TAURI__ === 'undefined') return;

  var invoke = window.__TAURI__.core.invoke;

  async function loadAndSendFile(result) {
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

  function patchFileInput() {
    var input = document.getElementById('file-input');
    if (input) input.click = openWithTauri;

    // 파일 메뉴가 열릴 때마다 최근 파일 목록 갱신
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
