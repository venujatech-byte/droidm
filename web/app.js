(() => {
  const invoke = window.__TAURI__?.core?.invoke;
  const $ = (selector) => document.querySelector(selector);
  const content = $('#content');
  const state = { serial: '', device: null, devices: [], tab: 'overview', telemetry: null, data: [], messageAddress: '', sensorsView: 'overview', dataUsageNetwork: 'wifi', sensorsCadence: 2000, sensorHistory: [], sensorTimer: null, sensorBusy: false, sensorFilter: '', sensorSort: 'cpu', sensorInventory: [], sensorReadings: [], sensorSelected: '', sensorInventorySerial: '', sensorInventoryLoading: false, sensorInventoryLoaded: false, path: '/sdcard', filesView: 'drives', storageVolumes: null, storageVolumesSerial: '', filesSelectedPath: '', filesSearch: '', filesSearchOpen: false, filesIconSize: 92, filesSort: 'name-asc', filesShowHidden: false, filesClipboard: null, filesThumbs: {}, filesThumbLoading: new Set(), filesThumbObserver: null, filesExporting: '', screenTimer: null, contacts: null, contactsSerial: '', toastTimer: null, lastTelemetry: 0, topAppsSelectedPid: null, topAppsExpandedGroups: new Set(), topAppsAppsExpanded: true, topAppsBgExpanded: true, topAppsSort: 'mem', topAppsSortDesc: true, topAppsSearch: '', powerPreset: 'balanced', gpuPreset: 'balanced', powerHist: [0.0, 0.0, 0.0], photosAlbum: 'all', photosSearch: '', photosDensity: 'comfortable', photosCursor: null, photosTotal: null, photosHasMore: true, photosPageLoading: false, photosThumbs: {}, photosThumbLoading: new Set(), photosObserver: null, photosSelected: new Set(), photosSelectionMode: false, photosLightboxIndex: null, photosCache: {}, photosCacheSerial: '', customSubtab: 'boot', customRootStatus: null, customFastbootDevices: null, customDensityVal: '', customAnimScale: '0.5' };
  document.addEventListener('pointerdown', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest('.files-menu-wrap')) document.querySelector('.files-options:not([hidden])')?.setAttribute('hidden', '');
    if (!target?.closest('.files-context-menu')) document.querySelector('.files-context-menu')?.remove();
  });
  const tabNames = { overview: 'Overview', screen: 'Screen share', messages: 'Messages', calls: 'Calls', photos: 'Photos', notifications: 'Notifications', sensors: 'Diagnosis', 'hardware-sensors': 'Sensors', storage: 'Files', apps: 'Apps', clipboard: 'Clipboard', terminal: 'Terminal', wireless: 'Wireless debugging', firmware: 'Customization & Boot' };
  const tabKinds = { messages: 'messages', calls: 'calls', photos: 'photos', notifications: 'notifications', sensors: 'sensors', apps: 'apps', storage: 'files', wireless: 'endpoints' };
  const icon = (code) => `<span class="icon" aria-hidden="true">&#x${code};</span>`;
  const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const val = (v, suffix = '', digits = 1) => {
    if (v == null || v === '') return 'Unavailable';
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) return 'Unavailable';
      return `${Number.isInteger(v) ? v : v.toFixed(digits)}${suffix}`;
    }
    const str = String(v).trim();
    if (!str) return 'Unavailable';
    const parsed = Number(str);
    if (!Number.isNaN(parsed) && str.includes('.')) {
      return `${parsed.toFixed(digits)}${suffix}`;
    }
    const cleaned = str.replace(/\b(\d+)\.(\d{3,})\b/g, (_, intPart, decPart) => {
      const num = Number(`${intPart}.${decPart}`);
      return Number.isFinite(num) ? num.toFixed(digits) : `${intPart}.${decPart.slice(0, digits)}`;
    });
    return `${cleaned}${suffix}`;
  };
  const invokeOrFail = (...args) => { if (!invoke) throw new Error('Open this page inside the Server Launcher Tauri window.'); return invoke(...args); };

  function toast(message, error = false) {
    const el = $('#toast'); el.textContent = message; el.className = `toast show${error ? ' error' : ''}`;
    clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => { el.className = 'toast'; }, 3300);
  }
  function setConnection(ok, label) { const el = $('#connection-state'); el.className = `connection ${ok ? 'online' : 'offline'}`; el.lastElementChild.textContent = label; }
  function updateHeaderTelemetryControls() {
    const ctrl = $('#sensors-header-controls');
    if (!ctrl) return;
    if (state.tab === 'sensors') {
      ctrl.style.display = 'inline-flex';
      const cadence = $('#sensor-cadence');
      if (cadence) cadence.value = String(state.sensorsCadence);
      const dot = $('#header-pulse-dot');
      const txt = $('#header-pulse-text');
      if (dot) {
        dot.style.background = state.sensorsCadence === 0 ? 'var(--dim)' : 'var(--green)';
        dot.style.boxShadow = state.sensorsCadence === 0 ? 'none' : '0 0 8px var(--green)';
        dot.style.animation = state.sensorsCadence === 0 ? 'none' : 'pulse-glow 2s infinite';
      }
      if (txt) {
        txt.textContent = state.sensorsCadence === 0 ? 'PAUSED' : 'LIVE 60S';
      }
    } else {
      ctrl.style.display = 'none';
    }
  }

  let currentLoadToken = 0;

  function showPageLoading(title = '') {
    const pageName = title || tabNames[state.tab] || 'Section';
    content.innerHTML = `
      <div class="page-loading-wrapper">
        <div class="page-loading-card">
          <div class="loading-brand-container">
            <img src="./icon.png" alt="Server Launcher Logo" class="loading-brand-logo" onerror="this.style.display='none'; const fb = document.getElementById('page-loading-fallback'); if (fb) fb.style.display='flex';" />
            <div id="page-loading-fallback" class="loading-brand-fallback icon">&#xe153;</div>
            <div class="loading-ring-pulse"></div>
          </div>
          <div class="loading-text-group">
            <h3 class="loading-heading">Loading ${escapeHtml(pageName)}</h3>
            <p class="loading-subtext">Communicating with Android Device via ADB Bridge…</p>
          </div>
        </div>
      </div>
    `;
  }

  function selectTab(tab) {
    if (!tabNames[tab]) return;
    if (tab !== 'photos') { state.photosObserver?.disconnect(); state.photosObserver = null; }
    clearInterval(state.screenTimer); state.screenTimer = null;
    state.tab = tab; document.body.classList.toggle('communications-style', ['messages', 'calls', 'apps'].includes(tab)); document.querySelectorAll('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.tab === tab));
    if (window.innerWidth <= 760) document.querySelector(`.nav-item[data-tab="${tab}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    clearTimeout(state.sensorTimer); state.sensorTimer = null;
    $('#page-title').textContent = tabNames[tab]; $('#eyebrow').textContent = `ANDROID DEVICE / ${tab.toUpperCase()}`;
    updateHeaderTelemetryControls();
    if (tab !== 'overview') {
      showPageLoading(tabNames[tab]);
    }
    void renderTab();
  }
  async function refreshDevices() {
    try {
      const devices = await invokeOrFail('adb_devices'); state.devices = devices;
      const online = devices.filter((d) => d.state === 'device');
      const picker = $('#device-select');
      if (!online.some((d) => d.serial === state.serial)) state.serial = online[0]?.serial ?? '';
      if (state.photosCacheSerial !== state.serial) {
        state.photosCacheSerial = state.serial; state.photosCursor = null; state.photosTotal = null; state.photosHasMore = true; state.photosPageLoading = false;
        state.photosThumbs = {}; state.photosThumbLoading.clear(); state.photosCache = {}; state.photosSelected.clear();
        state.storageVolumes = null; state.storageVolumesSerial = ''; state.filesView = 'drives'; state.path = '/sdcard'; state.filesSelectedPath = ''; state.filesSearch = ''; state.filesSearchOpen = false; state.filesClipboard = null; state.filesThumbs = {}; state.filesThumbLoading = new Set();
      }
      if (state.sensorHistory.length && state.sensorHistorySerial !== state.serial) { state.sensorHistory = []; state.sensorHistorySerial = state.serial; }
      if (state.sensorInventorySerial !== state.serial) { state.sensorInventory = []; state.sensorReadings = []; state.sensorSelected = ''; state.sensorInventorySerial = state.serial; state.sensorInventoryLoaded = false; }
      picker.innerHTML = online.length ? online.map((d) => `<option value="${escapeHtml(d.serial)}" ${d.serial === state.serial ? 'selected' : ''}>${escapeHtml(d.model || d.serial)}</option>`).join('') : '<option value="">No authorized device</option>';
      state.device = online.find((d) => d.serial === state.serial) || null;
      setConnection(Boolean(state.device), state.device ? `Connected · ${state.device.state}` : 'No authorized ADB device');
      $('#device-model').textContent = state.device?.model || 'No device selected';
      if (!state.device) { content.innerHTML = `<div class="card empty"><div class="empty-icon">${icon("e163")}</div><b>No Android device connected</b><span>Connect a device, enable USB debugging, and approve the computer’s RSA prompt.</span><button class="button tonal" id="retry-devices">Check again</button></div>`; return; }
      if (state.telemetry?.serial !== state.serial) state.telemetry = null;
      if (!state.telemetry) await refreshTelemetry();
    } catch (error) { setConnection(false, 'ADB unavailable'); content.innerHTML = `<div class="card empty"><div class="empty-icon">${icon("e1ae")}</div><b>Could not reach ADB</b><span>${escapeHtml(error)}</span><button class="button tonal" id="retry-devices">Retry</button></div>`; }
  }
  async function refreshTelemetry() {
    if (!state.serial) return;
    try { state.telemetry = await invokeOrFail('adb_telemetry', { serial: state.serial }); state.telemetry.serial = state.serial; state.lastTelemetry = Date.now(); await renderTab(); }
    catch (e) { toast(String(e), true); }
  }
  async function loadData(section, path) {
    if (!state.serial) return [];
    try { state.data = await invokeOrFail('adb_data', { serial: state.serial, section, path: path ?? null }); if (section === 'sensors') recordSensorSample(state.data); return state.data; }
    catch (error) { state.data = []; toast(String(error), true); return []; }
  }
  async function loadPhotoPage(reset = false) {
    if (state.photosPageLoading || (!reset && !state.photosHasMore) || !state.serial) return;
    state.photosPageLoading = true;
    const serial = state.serial;
    if (reset) { state.data = []; state.photosCursor = null; state.photosTotal = null; state.photosHasMore = true; }
    if (reset) invokeOrFail('adb_photos_count', { serial }).then((total) => {
      if (serial !== state.serial || state.tab !== 'photos') return;
      state.photosTotal = total;
      if (!state.photosPageLoading) renderPhotos();
    }).catch(() => {});
    try {
      const page = await invokeOrFail('adb_photos_page', { serial, cursor: reset ? null : state.photosCursor });
      if (serial !== state.serial || state.tab !== 'photos') return;
      state.data = reset ? page.items : state.data.concat(page.items);
      state.photosCursor = page.next_cursor;
      state.photosHasMore = Boolean(page.next_cursor);
