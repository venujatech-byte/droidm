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
    } catch (error) {
      toast(String(error), true);
    } finally {
      state.photosPageLoading = false;
    }
  }
  async function action(action, value = '', extra = '') {
    try { const result = await invokeOrFail('adb_action', { serial: state.serial, action, value: value || null, extra: extra || null }); if (result && !['shell', 'clipboard_get', 'pick_file', 'pick_folder', 'save_file'].includes(action)) toast(result); return result; }
    catch (error) { toast(String(error), true); throw error; }
  }
  const empty = (title, detail) => `<div class="empty"><div class="empty-icon">${icon("e0f9")}</div><b>${escapeHtml(title)}</b><span>${escapeHtml(detail)}</span></div>`;
  const card = (title, body, tools = '') => `<section class="card"><div class="card-head"><h2>${title}</h2><div>${tools}</div></div>${body}</section>`;
  const metric = (label, value, note, pct) => `<article class="card"><div class="metric-label">${label}</div><div class="metric-value">${value}</div><div class="metric-note">${note}</div>${pct == null ? '' : `<div class="progress"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>`}</article>`;
  function overview() {
    const t = state.telemetry || {}, battery = t.battery_pct;
    const used = t.storage_internal_total_gb && t.storage_internal_free_gb != null ? Math.max(0, 100 * (1 - t.storage_internal_free_gb / t.storage_internal_total_gb)) : null;
    return `<section class="card hero"><div><span class="badge">● ${escapeHtml(state.device?.state || 'device')}</span><h2>${escapeHtml(t.model || state.device?.model || state.serial)}</h2><div class="subtle">${escapeHtml(t.manufacturer || 'Android device')} · ${escapeHtml(state.serial)} · Android ${escapeHtml(val(t.android_version))}</div></div><div class="hero-actions"><button class="button tonal" data-tab="screen">${icon("e14f")} Screen share</button><button class="button primary" data-action="scrcpy">${icon("e0b9")} Open scrcpy</button><button class="button" data-action="reboot" data-value="system">${icon("e145")} Restart</button></div></section>
      <div class="grid metrics">${metric('Battery', val(battery, '%'), val(t.battery_status), battery)}${metric('Internal storage', t.storage_internal_total_gb != null ? `${(t.storage_internal_total_gb - (t.storage_internal_free_gb || 0)).toFixed(1)} GB` : 'Unavailable', t.storage_internal_total_gb != null ? `${(t.storage_internal_free_gb ?? 0).toFixed(1)} GB free` : 'Device data unavailable', used)}${metric('Display', escapeHtml(val(t.screen_res)), escapeHtml(val(t.screen_dpi)), null)}${metric('Uptime', t.uptime_secs ? `${Math.floor(t.uptime_secs / 3600)}h ${Math.floor(t.uptime_secs % 3600 / 60)}m` : 'Unavailable', `${escapeHtml(val(t.cpu_abi))} · API ${escapeHtml(val(t.api_level))}`, null)}</div>
      <div class="grid two">${card('Device information', `<div class="kv"><div><small>Brand</small><b>${escapeHtml(val(t.brand))}</b></div><div><small>Build</small><b>${escapeHtml(val(t.build_id))}</b></div><div><small>Security patch</small><b>${escapeHtml(val(t.security_patch))}</b></div><div><small>SELinux</small><b>${escapeHtml(val(t.selinux))} · ${t.is_rooted ? 'Rooted' : 'Unrooted'}</b></div></div>`)}${card('ADB connection', `<div class="kv"><div><small>Transport</small><b>${state.serial.includes(':') ? 'Wireless TCP/IP' : 'USB debugging'}</b></div><div><small>Product</small><b>${escapeHtml(val(state.device?.product))}</b></div><div><small>Device ID</small><b class="mono">${escapeHtml(state.serial)}</b></div><div><small>Refresh cadence</small><b>On demand · low overhead</b></div></div>`)}</div>`;
  }
  async function renderTab() {
    if (!state.device) return;
    const loadToken = ++currentLoadToken;
    const targetTab = state.tab;
    if (targetTab === 'overview') { content.innerHTML = overview(); return; }
    if (tabKinds[targetTab]) {
      showPageLoading(tabNames[targetTab]);
      if (targetTab === 'photos') await loadPhotoPage(true);
      else if (targetTab === 'storage' && state.filesView === 'drives') state.data = [];
      else await loadData(tabKinds[targetTab], state.path);
      if (loadToken !== currentLoadToken || state.tab !== targetTab) return;
    }
    if (!state.device || state.tab !== targetTab) return;
    switch (targetTab) {
      case 'screen': return renderScreen();
      case 'messages': return renderMessages();
      case 'calls': return renderCalls();
      case 'photos': return renderPhotos();
      case 'notifications': return renderNotifications();
      case 'sensors': return renderSensors();
      case 'hardware-sensors': return renderHardwareSensors();
      case 'storage': return renderStorage();
      case 'apps': return renderApps();
      case 'clipboard': return renderClipboard();
      case 'terminal': return renderTerminal();
      case 'wireless': return renderWireless();
      case 'firmware': return renderFirmware();
    }
  }
  function renderScreen() {
    content.innerHTML = `<div class="screen-layout"><section class="card screen-stage"><div class="screen-phone" id="screen-image">${empty('Screen capture ready', 'Use Refresh to fetch the current device screen.')}</div></section><div class="stack"><section class="card"><div class="card-head"><h2>Screen controls</h2></div><div class="toolbar"><button class="button primary" id="screen-refresh">${icon("e145")} Refresh screen</button><button class="button tonal" data-action="scrcpy">Open scrcpy</button></div><div class="screen-controls"><button class="button" data-action="key_back">${icon("e048")} Back</button><button class="button" data-action="key_home">${icon("e101")} Home</button><button class="button" data-action="key_recents">${icon("e101")} Recent</button><button class="button" data-action="key_volume_down">Vol −</button><button class="button" data-action="key_volume_up">Vol +</button><button class="button" data-action="key_power">Power</button></div><div class="form-row" style="margin-top:12px"><input class="input" id="screen-text" placeholder="Type text on device…"><button class="button" id="send-screen-text">Send</button></div></section><section class="card"><h3>Mirror options</h3><p class="subtle">For smooth interactive control, scrcpy runs in its own optimized window. Static screen preview refreshes every 3 seconds while this tab is active.</p></section></div></div>`;
    const take = async () => { const target = $('#screen-image'); if (!target || !state.serial) return; try { const src = await invokeOrFail('adb_screenshot', { serial: state.serial }); target.innerHTML = `<img alt="Current Android screen" src="${src}">`; } catch (e) { target.innerHTML = `<div class="muted">${escapeHtml(e)}</div>`; } };
    $('#screen-refresh').onclick = take; void take(); state.screenTimer = setInterval(take, 3000);
    $('#send-screen-text').onclick = async () => { const text = $('#screen-text').value; if (text) await action('send_text', text); };
  }
  function renderMessages() {
    const rows = state.data || [];
    const conversations = [...rows.reduce((groups, message) => {
      const address = message.address || 'Unknown contact';
      if (!groups.has(address)) groups.set(address, []);
      groups.get(address).push(message);
      return groups;
    }, new Map())].map(([address, messages]) => ({ address, messages, latest: messages[0] }));
    if (!conversations.some((conversation) => conversation.address === state.messageAddress)) state.messageAddress = conversations[0]?.address || '';
    const selected = conversations.find((conversation) => conversation.address === state.messageAddress);
    content.innerHTML = `<div class="comm-page"><div class="comm-layout messages-layout"><section class="card comm-list-pane"><div class="card-head"><div><h3>Conversations</h3><span class="subtle">${conversations.length} threads · ${rows.length} messages</span></div></div><input id="message-filter" class="input" type="search" placeholder="Search conversations" aria-label="Search conversations"><div class="comm-list">${conversations.length ? conversations.map((conversation) => `<button class="comm-row ${conversation.address === state.messageAddress ? 'selected' : ''}" data-message-address="${escapeHtml(conversation.address)}"><span class="comm-avatar">${escapeHtml((conversation.latest.contact || conversation.address).slice(0, 1).toUpperCase())}</span><span class="comm-row-copy"><span class="comm-row-top"><b>${escapeHtml(conversation.latest.contact || conversation.address)}</b><time>${escapeHtml(conversation.latest.time)}</time></span><span class="comm-preview">${conversation.latest.outgoing ? 'You: ' : ''}${escapeHtml(conversation.latest.text)}</span></span></button>`).join('') : empty('No messages available', 'SMS conversations will appear here when the device provides them.')}</div></section><section class="card comm-thread-pane">${selected ? `<div class="thread-head"><span class="comm-avatar">${escapeHtml((selected.latest.contact || selected.address).slice(0, 1).toUpperCase())}</span><div><h3>${escapeHtml(selected.latest.contact || selected.address)}</h3><span class="subtle">${escapeHtml(selected.address)}</span></div></div><div class="message-thread">${selected.messages.slice().reverse().map((message) => `<article class="message-bubble ${message.outgoing ? 'outgoing' : 'incoming'}"><p>${escapeHtml(message.text)}</p><time>${escapeHtml(message.time)}</time></article>`).join('')}</div><form id="sms-form" class="message-composer"><label class="subtle" for="sms-number">To</label><input id="sms-number" class="input" value="${escapeHtml(selected.address)}" aria-label="Recipient phone number"><div class="composer-row"><textarea id="sms-body" class="input" rows="2" placeholder="Write a message…" aria-label="Message"></textarea><button class="button primary" id="sms-send" type="submit">${icon("e1e0")} Open SMS app</button></div><span class="subtle">Review and send in your device’s messaging app. Carrier charges may apply.</span></form>` : `<div class="thread-empty">${empty('Select a conversation', 'Choose a conversation to read or reply.')}</div>`}</section></div></div>`;
    $('#message-filter').oninput = (event) => document.querySelectorAll('.comm-row').forEach((row) => { row.hidden = !row.textContent.toLowerCase().includes(event.target.value.toLowerCase()); });
    document.querySelectorAll('[data-message-address]').forEach((button) => button.onclick = () => { state.messageAddress = button.dataset.messageAddress; renderMessages(); });
    $('#sms-form')?.addEventListener('submit', async (event) => { event.preventDefault(); const number = $('#sms-number').value.trim(), body = $('#sms-body').value.trim(); if (!number || !body) return toast('Enter a number and message.', true); const send = $('#sms-send'); send.disabled = true; try { await action('send_sms', number, body); } catch {} finally { if ($('#sms-send')) $('#sms-send').disabled = false; } });
  }
  async function renderCalls() {
    const rows = state.data || [];
    if (!state.contacts || state.contactsSerial !== state.serial) {
      const serial = state.serial;
      try {
        const contacts = await invokeOrFail('adb_data', { serial, section: 'contacts', path: null }) || [];
        if (serial !== state.serial || state.tab !== 'calls') return;
        state.contacts = contacts;
        state.contactsSerial = serial;
        state.contactsError = '';
      } catch (error) {
        if (serial !== state.serial || state.tab !== 'calls') return;
        state.contacts = [];
        state.contactsSerial = serial;
        state.contactsError = String(error);
      }
    }
    const contacts = state.contacts || [];
    const subtab = state.callsSubtab || 'contacts';

    content.innerHTML = `
      <div class="comm-page">
        <div class="comm-layout calls-layout">
          <section class="card comm-list-pane">
            <div class="comm-tab-pills">
              <button class="comm-tab-pill ${subtab === 'calls' ? 'active' : ''}" data-calls-subtab="calls">
                <span class="icon">&#xe0b0;</span>
                <span>Recent Calls (${rows.length})</span>
              </button>
              <button class="comm-tab-pill ${subtab === 'contacts' ? 'active' : ''}" data-calls-subtab="contacts">
                <span class="icon">&#xe7fd;</span>
                <span>Contacts (${contacts.length})</span>
              </button>
            </div>

            ${subtab === 'calls' ? `
              <div class="card-head" style="margin-top: 4px;">
                <div>
                  <h3>Recent Calls History</h3>
                  <span class="subtle">${rows.length} call records logged</span>
                </div>
              </div>
              <input id="call-filter" class="input" type="search" placeholder="Search recent calls..." aria-label="Search recent calls">
              <div id="call-list" class="comm-list">
                ${rows.length ? rows.map((call) => `
                  <article class="comm-row call-row" data-pick-number="${escapeHtml(call.number)}">
                    <span class="comm-avatar call-avatar">${icon(call.kind === 'Missed' ? 'e11b' : 'e135')}</span>
                    <span class="comm-row-copy">
                      <span class="comm-row-top">
                        <b>${escapeHtml(call.name || call.number || 'Unknown caller')}</b>
                        <time>${escapeHtml(call.time)}</time>
                      </span>
                      <span class="comm-preview">${escapeHtml(call.kind)} · ${escapeHtml(call.duration)} · ${escapeHtml(call.number)}</span>
                    </span>
                    <button class="button tonal call-back" data-action="call" data-value="${escapeHtml(call.number)}" aria-label="Call ${escapeHtml(call.name || call.number)}" title="Call back">
                      <span class="icon">&#xe0cd;</span>
                    </button>
                  </article>
                `).join('') : empty('No call history', 'Recent calls will appear here when recorded on the device.')}
              </div>
            ` : `
              <div class="card-head" style="margin-top: 4px;">
                <div>
                  <h3>Device Contacts</h3>
                  <span class="subtle">${contacts.length} entries in address book</span>
                </div>
              </div>
              <input id="contact-filter" class="input" type="search" placeholder="Search contacts by name or phone..." aria-label="Search contacts">
              <div id="contact-list" class="comm-list">
                ${contacts.length ? contacts.map((contact) => `
                  <article class="comm-row contact-row" data-pick-number="${escapeHtml(contact.number)}">
                    <span class="comm-avatar contact-avatar">${escapeHtml((contact.name || contact.number || '?').slice(0, 1).toUpperCase())}</span>
                    <span class="comm-row-copy">
                      <span class="comm-row-top">
                        <b>${escapeHtml(contact.name || 'Unnamed')}</b>
                      </span>
                      <span class="comm-preview"><span class="mono">${escapeHtml(contact.number)}</span></span>
                    </span>
                    <button class="button tonal call-back" data-action="call" data-value="${escapeHtml(contact.number)}" aria-label="Call ${escapeHtml(contact.name)}" title="Call contact">
                      <span class="icon">&#xe0cd;</span>
                    </button>
                  </article>
                `).join('') : empty(state.contactsError ? 'Contacts unavailable' : 'No contacts found', state.contactsError || 'No saved phone numbers on this device.')}
              </div>
            `}
          </section>

          <section class="card comm-dial-pane">
            <div class="dialer-title">
              <div>
                <h3>Call controls</h3>
                <div class="subtle">Answer on device · route audio with Android</div>
              </div>
              <span class="badge">PHONE</span>
            </div>

            <div class="call-control-window">
              <span class="call-control-avatar">${icon("e0cd")}</span>
              <div class="call-control-copy"><b>Android call</b><span>Use device or connected headset for audio</span></div>
              <button class="button tonal" data-action="bluetooth_auto_connect" title="Open Android Bluetooth pairing">Bluetooth</button>
              <button class="button success tonal" data-action="answer_call" title="Answer a ringing call">Answer</button>
              <button class="button danger tonal" data-action="hangup" title="End an ongoing call">End</button>
            </div>

            <div class="dial-input-container">
              <input id="dial-number" class="input dial-input" placeholder="Enter phone number..." inputmode="tel" autocomplete="tel">
              <button id="dial-backspace" class="dial-backspace-btn" title="Delete last digit">
                <span class="icon">&#xe14a;</span>
              </button>
            </div>

            <div class="keypad">
              ${[
                { k: '1', s: '' }, { k: '2', s: 'ABC' }, { k: '3', s: 'DEF' },
                { k: '4', s: 'GHI' }, { k: '5', s: 'JKL' }, { k: '6', s: 'MNO' },
                { k: '7', s: 'PQRS' }, { k: '8', s: 'TUV' }, { k: '9', s: 'WXYZ' },
                { k: '*', s: '' }, { k: '0', s: '+' }, { k: '#', s: '' }
              ].map(({ k, s }) => `
                <button class="button key dial-key-btn" data-key="${k}" aria-label="${k}">
                  <span class="key-digit">${k}</span>
                  ${s ? `<span class="key-sub">${s}</span>` : ''}
                </button>
              `).join('')}
            </div>

            <div class="dial-actions-row">
              <button class="button success dial-submit" id="dial-call" title="Place phone call">
                <span class="icon">&#xe0cd;</span>
                <span>Call</span>
              </button>
            </div>
            <p class="subtle dial-note">Calls use the device SIM. Android may ask you to select a SIM or confirm.</p>
          </section>
        </div>
      </div>
    `;

    document.querySelectorAll('[data-calls-subtab]').forEach(btn => {
      btn.onclick = () => {
        state.callsSubtab = btn.dataset.callsSubtab;
        renderCalls();
      };
    });

    const callFilter = $('#call-filter');
    if (callFilter) {
      callFilter.oninput = (e) => {
        const q = e.target.value.toLowerCase();
        document.querySelectorAll('.call-row').forEach(row => {
          row.hidden = !row.textContent.toLowerCase().includes(q);
        });
      };
    }

    const contactFilter = $('#contact-filter');
    if (contactFilter) {
      contactFilter.oninput = (e) => {
        const q = e.target.value.toLowerCase();
        document.querySelectorAll('.contact-row').forEach(row => {
          row.hidden = !row.textContent.toLowerCase().includes(q);
        });
      };
    }

    document.querySelectorAll('[data-pick-number]').forEach(row => {
      row.onclick = (e) => {
        if (e.target.closest('button')) return;
        const num = row.dataset.pickNumber;
        if (num) {
          const input = $('#dial-number');
          if (input) {
            input.value = num;
            input.focus();
          }
        }
      };
    });

    document.querySelectorAll('[data-key]').forEach(k => {
      k.onclick = () => {
        const input = $('#dial-number');
        if (input) {
          input.value += k.dataset.key;
          input.focus();
        }
      };
    });

    const backspaceBtn = $('#dial-backspace');
    if (backspaceBtn) {
      backspaceBtn.onclick = () => {
        const input = $('#dial-number');
        if (input && input.value.length > 0) {
          input.value = input.value.slice(0, -1);
          input.focus();
        }
      };
    }

    const callBtn = $('#dial-call');
    if (callBtn) {
      callBtn.onclick = async () => {
        const input = $('#dial-number');
        const num = input ? input.value.trim() : '';
        if (num) {
          callBtn.disabled = true;
          try {
            await action('call', num);
          } catch (err) {
            // action() already displays the Android error.
          } finally {
            callBtn.disabled = false;
          }
        } else {
          toast('Enter a phone number to call.', true);
        }
      };
    }
  }
  function renderPhotos() {
    document.querySelector('.photo-context-menu')?.remove();
    const rows = state.data || [];
    const q = (state.photosSearch || '').trim().toLowerCase();
    const album = state.photosAlbum || 'all';

    const getAlbum = (p) => {
      const path = (p.path || '').toLowerCase();
      const name = (p.name || '').toLowerCase();
      if (path.includes('/screenshots/') || name.includes('screenshot')) return 'screenshots';
      if (path.includes('/download')) return 'downloads';
      if (path.includes('/dcim/') || path.includes('/camera/')) return 'camera';
      return 'other';
    };

    const filtered = rows.filter(p => {
      if (album === 'camera' && getAlbum(p) !== 'camera') return false;
      if (album === 'screenshots' && getAlbum(p) !== 'screenshots') return false;
      if (album === 'downloads' && getAlbum(p) !== 'downloads') return false;
      if (q && !((p.name || '').toLowerCase().includes(q) || (p.path || '').toLowerCase().includes(q))) return false;
      return true;
    });
    const visible = filtered;

    const isSelected = (path) => state.photosSelected.has(path);
    const density = state.photosDensity || 'comfortable';

    content.innerHTML = `
      <div class="photos-page">
        <!-- Top Header Card -->
        <header class="photos-header-card">
          <div class="photos-header-info">
            <h2>${icon("e0f7")} Camera Roll & Gallery</h2>
            <div class="photos-header-sub">${state.photosTotal == null ? 'Counting photos…' : `${state.photosTotal} photos total`} · ${rows.length} loaded</div>
          </div>
          <div class="photos-header-actions">
            <button class="button tonal" id="photo-upload-btn">${icon("e0cc")} Push Photo to Device</button>
            <button class="button" data-refresh>${icon("e145")} Refresh</button>
          </div>
        </header>

        <!-- Filter & Search Toolbar -->
        <div class="photos-filter-bar">
          <div class="photos-albums">
            <button class="album-pill ${album === 'all' ? 'active' : ''}" data-album="all">${icon("e0d7")} All (${state.photosTotal ?? rows.length})</button>
            <button class="album-pill ${album === 'camera' ? 'active' : ''}" data-album="camera">${icon("e0f7")} Camera</button>
            <button class="album-pill ${album === 'screenshots' ? 'active' : ''}" data-album="screenshots">${icon("e14f")} Screenshots</button>
            <button class="album-pill ${album === 'downloads' ? 'active' : ''}" data-album="downloads">${icon("e0cc")} Downloads</button>
          </div>

          <div style="display:flex; align-items:center; gap:8px;">
            <div class="photos-search-wrap">
              <svg class="photos-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path></svg>
              <input id="photos-search-input" class="photos-search-input" type="search" placeholder="Search photos..." value="${escapeHtml(state.photosSearch)}">
            </div>

            <div class="density-toggle">
              <button class="density-btn ${density === 'compact' ? 'active' : ''}" data-density="compact" title="Compact density">Compact</button>
              <button class="density-btn ${density === 'comfortable' ? 'active' : ''}" data-density="comfortable" title="Comfortable density">Medium</button>
              <button class="density-btn ${density === 'large' ? 'active' : ''}" data-density="large" title="Large cards">Large</button>
            </div>
          </div>
        </div>

        <!-- Photo Grid -->
        ${filtered.length > 0 ? `
          <div class="photo-grid density-${density} ${state.photosSelected.size > 0 ? 'selection-mode' : ''}">
            ${visible.map((p) => {
              const idx = filtered.indexOf(p);
              const selected = isSelected(p.path);
              const cachedSrc = state.photosThumbs[p.path];
              const ext = (p.name.split('.').pop() || 'JPG').toUpperCase();
              return `
                <article class="photo-card ${selected ? 'selected' : ''}" data-photo-path="${escapeHtml(p.path)}">
                  <div class="photo-select-box" data-photo-select="${escapeHtml(p.path)}" title="Select photo">
                    ${selected ? icon("e10b") : ''}
                  </div>
                  <div class="photo-thumb-container" data-photo-view="${idx}">
                    ${cachedSrc ? `
                      <img class="photo-thumb-img" src="${cachedSrc}" alt="${escapeHtml(p.name)}" loading="lazy">
                    ` : `
                      <div class="photo-thumb-placeholder" id="thumb-holder-${idx}">
                        ${icon("e0f7")}
                        <span>${escapeHtml(ext)}</span>
                      </div>
                    `}
                  </div>
                </article>
              `;
            }).join('')}
          </div>
        ` : empty('No photos found', rows.length === 0 ? 'No photos returned from /sdcard/DCIM or MediaStore. Click "Push Photo to Device" to transfer images to the camera roll.' : 'No photos match your filter or search query.')}

        ${state.photosHasMore ? `<div class="photos-load-more" id="photos-load-more" aria-live="polite">${state.photosPageLoading ? 'Loading more photos…' : ''}</div>` : ''}

        <!-- Floating Bulk Selection Bar -->
        ${state.photosSelected.size > 0 ? `
          <div class="photo-floating-bar">
            <span class="photo-selected-count">${state.photosSelected.size} selected</span>
            <button class="button success tonal" id="bulk-download-btn">${icon("e0cc")} Save Selected</button>
            <button class="button danger tonal" id="bulk-delete-btn">${icon("e048")} Delete Selected</button>
            <button class="button tonal" id="bulk-clear-btn">Deselect All</button>
          </div>
        ` : ''}

        <!-- Lightbox Modal -->
        ${state.photosLightboxIndex !== null && filtered[state.photosLightboxIndex] ? (() => {
          const p = filtered[state.photosLightboxIndex];
          const cachedSrc = state.photosCache[p.path];
          return `
            <div class="photo-lightbox" id="photo-lightbox-modal">
              <div class="lightbox-topbar">
                <div class="lightbox-title-box">
                  ${icon("e0f7")}
                  <span class="lightbox-filename">${escapeHtml(p.name)}</span>
                  <span class="lightbox-counter">${state.photosLightboxIndex + 1} / ${filtered.length}</span>
                </div>
                <div class="lightbox-actions">
                  <button class="button" id="lightbox-close-btn">Close</button>
                </div>
              </div>

              <div class="lightbox-stage">
                ${state.photosLightboxIndex > 0 ? `
                  <button class="lightbox-nav-btn prev" id="lightbox-prev-btn" title="Previous photo (←)">‹</button>
                ` : ''}
                <div id="lightbox-img-container" style="display:grid; place-items:center; width:100%; height:100%;">
                  ${cachedSrc ? `
                    <img src="${cachedSrc}" alt="${escapeHtml(p.name)}">
                  ` : `
                    <div class="page-loading-card" style="padding:24px 32px; max-width:320px;">
                      <div class="loading-brand-container" style="width:68px; height:68px; margin-bottom:14px;">
                        <img src="./icon.png" alt="Loading" class="loading-brand-logo" style="width:46px; height:46px;" onerror="this.style.display='none';" />
                        <div class="loading-ring-pulse"></div>
                      </div>
                      <div class="loading-heading" style="font-size:14px;">Loading photo…</div>
                      <div class="loading-subtext">Fetching original bytes from Android storage</div>
                    </div>
                  `}
                </div>
                ${state.photosLightboxIndex < filtered.length - 1 ? `
                  <button class="lightbox-nav-btn next" id="lightbox-next-btn" title="Next photo (→)">›</button>
                ` : ''}
              </div>

              <div class="lightbox-footer">
                <span>Press ← / → to navigate, Esc to close</span>
              </div>
            </div>
          `;
        })() : ''}
      </div>
    `;

    // 1. Search input
    const searchInput = $('#photos-search-input');
    if (searchInput) {
      searchInput.oninput = (e) => {
        state.photosSearch = e.target.value;
        renderPhotos();
        const fresh = $('#photos-search-input');
        if (fresh) { fresh.focus(); fresh.setSelectionRange(fresh.value.length, fresh.value.length); }
      };
    }

    // 2. Album pills
    document.querySelectorAll('[data-album]').forEach(btn => {
      btn.onclick = () => {
        state.photosAlbum = btn.dataset.album;
        renderPhotos();
      };
    });

    // 3. Density toggle
    document.querySelectorAll('[data-density]').forEach(btn => {
      btn.onclick = () => {
        state.photosDensity = btn.dataset.density;
        renderPhotos();
      };
    });

    const loadMorePhotos = async () => {
      if (state.tab !== 'photos' || !state.photosHasMore || state.photosPageLoading) return;
      const scrollTop = content.scrollTop;
      await loadPhotoPage();
      if (state.tab !== 'photos') return;
      renderPhotos();
      content.scrollTop = scrollTop;
    };
    state.photosObserver?.disconnect();
    if (state.photosHasMore && 'IntersectionObserver' in window) {
      state.photosObserver = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMorePhotos();
      }, { root: content, rootMargin: '240px' });
      state.photosObserver.observe($('#photos-load-more'));
    } else if (state.photosHasMore) {
      content.onscroll = () => {
        if (content.scrollTop + content.clientHeight >= content.scrollHeight - 240) loadMorePhotos();
      };
    } else {
      content.onscroll = null;
    }

    // 4. Push / Upload photo
    const uploadBtn = $('#photo-upload-btn');
    if (uploadBtn) {
      uploadBtn.onclick = async () => {
        try {
          const filePath = await action('pick_file', 'jpg,jpeg,png,webp');
          if (filePath) {
            toast('Pushing photo to /sdcard/DCIM/Camera/...');
            await action('push_photo', filePath);
            toast('Photo pushed and scanned into gallery!');
            await loadPhotoPage(true);
            renderPhotos();
          }
        } catch (err) {
          if (!String(err).includes('cancelled')) toast(String(err), true);
        }
      };
    }

    // 5. Lightbox open
    document.querySelectorAll('[data-photo-view]').forEach(el => {
      el.onclick = async (e) => {
        e.stopPropagation();
        const idx = Number(el.dataset.photoView);
        state.photosLightboxIndex = idx;
        renderPhotos();
        const targetPhoto = filtered[idx];
        if (targetPhoto && !state.photosCache[targetPhoto.path]) {
          try {
            const src = await invokeOrFail('adb_photo_preview', { serial: state.serial, path: targetPhoto.path });
            state.photosCache[targetPhoto.path] = src;
            const container = $('#lightbox-img-container');
            if (container && state.photosLightboxIndex === idx) {
              container.innerHTML = `<img src="${src}" alt="${escapeHtml(targetPhoto.name)}">`;
            }
          } catch (err) {
            toast('Failed to load image preview: ' + err, true);
          }
        }
      };
    });

    document.querySelectorAll('.photo-card').forEach((card) => card.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      const index = Number(card.querySelector('[data-photo-view]')?.dataset.photoView);
      const photo = filtered[index];
      if (!photo) return;
      document.querySelector('.photo-context-menu')?.remove();
      const menu = document.createElement('div');
      menu.className = 'photo-context-menu';
      menu.style.left = `${Math.min(event.clientX, window.innerWidth - 170)}px`;
      menu.style.top = `${Math.min(event.clientY, window.innerHeight - 150)}px`;
      menu.innerHTML = '<button data-photo-menu="open">Open</button><button data-photo-menu="save">Save to PC</button><button data-photo-menu="delete" class="danger">Delete</button>';
      document.body.append(menu);
      const close = (outsideEvent) => {
        if (!menu.contains(outsideEvent.target)) { menu.remove(); window.removeEventListener('pointerdown', close); }
      };
      window.addEventListener('pointerdown', close);
      menu.onclick = async (click) => {
        const choice = click.target.closest('[data-photo-menu]')?.dataset.photoMenu;
        menu.remove(); window.removeEventListener('pointerdown', close);
        if (choice === 'open') document.querySelector(`[data-photo-view="${index}"]`)?.click();
        if (choice === 'save') await action('download_photo', photo.path);
        if (choice === 'delete' && confirm(`Delete ${photo.name} from the device?`)) {
          await action('delete_photo', photo.path);
          delete state.photosCache[photo.path];
          state.photosSelected.delete(photo.path);
          await loadPhotoPage(true);
          renderPhotos();
        }
      };
    }));

    // 6. Selection checkbox
    document.querySelectorAll('[data-photo-select]').forEach(box => {
      box.onclick = (e) => {
        e.stopPropagation();
        const path = box.dataset.photoSelect;
        if (state.photosSelected.has(path)) {
          state.photosSelected.delete(path);
        } else {
          state.photosSelected.add(path);
        }
        renderPhotos();
