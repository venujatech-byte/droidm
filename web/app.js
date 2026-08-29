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
      };
    });

    // 8. Bulk action bar
    const bulkDownload = $('#bulk-download-btn');
    if (bulkDownload) {
      bulkDownload.onclick = async () => {
        const paths = Array.from(state.photosSelected);
        toast(`Saving ${paths.length} photos to PC Downloads...`);
        for (const p of paths) {
          try { await action('download_photo', p); } catch {}
        }
        toast(`Exported ${paths.length} photos!`);
      };
    }

    const bulkDelete = $('#bulk-delete-btn');
    if (bulkDelete) {
      bulkDelete.onclick = async () => {
        const paths = Array.from(state.photosSelected);
        if (confirm(`Permanently delete ${paths.length} selected photos from your device?`)) {
          for (const p of paths) {
            try {
              await action('delete_photo', p);
              delete state.photosCache[p];
            } catch {}
          }
          state.photosSelected.clear();
          toast(`Deleted ${paths.length} photos.`);
          await loadPhotoPage(true);
          renderPhotos();
        }
      };
    }

    const bulkClear = $('#bulk-clear-btn');
    if (bulkClear) {
      bulkClear.onclick = () => {
        state.photosSelected.clear();
        renderPhotos();
      };
    }

    // 9. Lightbox controls
    const lightboxModal = $('#photo-lightbox-modal');
    if (lightboxModal && state.photosLightboxIndex !== null) {
      const closeLb = () => { state.photosLightboxIndex = null; renderPhotos(); };

      const closeBtn = $('#lightbox-close-btn');
      if (closeBtn) closeBtn.onclick = closeLb;

      const prevBtn = $('#lightbox-prev-btn');
      if (prevBtn) {
        prevBtn.onclick = () => {
          if (state.photosLightboxIndex > 0) {
            state.photosLightboxIndex--;
            renderPhotos();
            const prevP = filtered[state.photosLightboxIndex];
            if (prevP && !state.photosCache[prevP.path]) {
              invokeOrFail('adb_photo_preview', { serial: state.serial, path: prevP.path }).then(src => {
                state.photosCache[prevP.path] = src;
                const container = $('#lightbox-img-container');
                if (container) container.innerHTML = `<img src="${src}" alt="${escapeHtml(prevP.name)}">`;
              });
            }
          }
        };
      }

      const nextBtn = $('#lightbox-next-btn');
      if (nextBtn) {
        nextBtn.onclick = () => {
          if (state.photosLightboxIndex < filtered.length - 1) {
            state.photosLightboxIndex++;
            renderPhotos();
            const nextP = filtered[state.photosLightboxIndex];
            if (nextP && !state.photosCache[nextP.path]) {
              invokeOrFail('adb_photo_preview', { serial: state.serial, path: nextP.path }).then(src => {
                state.photosCache[nextP.path] = src;
                const container = $('#lightbox-img-container');
                if (container) container.innerHTML = `<img src="${src}" alt="${escapeHtml(nextP.name)}">`;
              });
            }
          }
        };
      }

      const keyHandler = (e) => {
        if (state.photosLightboxIndex === null) {
          window.removeEventListener('keydown', keyHandler);
          return;
        }
        if (e.key === 'Escape') {
          closeLb();
        } else if (e.key === 'ArrowLeft' && prevBtn) {
          prevBtn.click();
        } else if (e.key === 'ArrowRight' && nextBtn) {
          nextBtn.click();
        }
      };
      if (window.__photoKeyHandler) window.removeEventListener('keydown', window.__photoKeyHandler);
      window.__photoKeyHandler = keyHandler;
      window.addEventListener('keydown', keyHandler);
    }
    void loadPhotoThumbnails(visible);
  }

  async function loadPhotoThumbnails(photos) {
    const serial = state.serial;
    const loadOne = async (photo) => {
      if (state.photosThumbs[photo.path] || state.photosThumbLoading.has(photo.path)) return;
      state.photosThumbLoading.add(photo.path);
      try {
        const src = await invokeOrFail('adb_photo_thumbnail', { serial, path: photo.path });
        if (serial !== state.serial) return;
        state.photosThumbs[photo.path] = src;
        const card = [...document.querySelectorAll('.photo-card')].find((item) => item.dataset.photoPath === photo.path);
        const holder = card?.querySelector('.photo-thumb-placeholder');
        if (holder) {
          const image = document.createElement('img');
          image.className = 'photo-thumb-img'; image.alt = photo.name; image.loading = 'lazy'; image.src = src;
          holder.replaceWith(image);
        }
      } catch {
        // Keep the file-type placeholder when this image cannot be decoded.
      } finally {
        state.photosThumbLoading.delete(photo.path);
      }
    };
    for (let index = 0; index < photos.length; index += 2) {
      await Promise.all(photos.slice(index, index + 2).map(loadOne));
    }
  }
  function renderNotifications() {
    const rows = state.data || [];
    const packageLabels = {
      'com.whatsapp.w4b': 'WhatsApp Business',
      'com.whatsapp': 'WhatsApp',
      'com.google.android.gm': 'Gmail',
      'com.google.android.apps.messaging': 'Messages',
      'com.samsung.android.messaging': 'Samsung Messages',
      'com.android.mms': 'Messages',
      'com.android.phone': 'Phone',
      'com.google.android.dialer': 'Phone',
      'com.android.systemui': 'Android System',
      'com.google.android.calendar': 'Calendar',
      'com.google.android.youtube': 'YouTube',
      'com.android.chrome': 'Chrome',
      'com.google.android.googlequicksearchbox': 'Google'
    };
    const appLabel = (notification) => packageLabels[notification.package] || notification.app || notification.package || 'Android app';
    const appIcon = (notification) => {
      const pkg = String(notification.package || '').toLowerCase();
      if (pkg.includes('whatsapp') || pkg.includes('messaging') || pkg.includes('.mms')) return 'e575';
      if (pkg.includes('gmail') || pkg.includes('email')) return 'e10f';
      if (pkg.includes('calendar')) return 'e063';
      if (pkg.includes('dialer') || pkg.includes('.phone')) return 'e134';
      if (pkg.includes('systemui') || pkg === 'android') return 'e163';
      if (pkg.includes('youtube')) return 'e13c';
      if (pkg.includes('chrome') || pkg.includes('browser')) return 'e0e8';
      if (pkg.includes('music')) return 'e34a';
      return 'e224';
    };
    content.innerHTML = `<section class="notifications-page"><header class="notifications-toolbar"><div class="notifications-total"><strong>${rows.length}</strong><span>active notifications</span></div><button class="button" data-refresh>${icon('e145')} Refresh</button></header>${rows.length ? `<div class="notifications-list">${rows.map((n) => {
      const app = appLabel(n);
      const title = n.title || n.text || app;
      const preview = n.title ? (n.text || n.subtext) : n.subtext;
      return `<article class="notification-item"><span class="notification-app-icon" aria-hidden="true">${icon(appIcon(n))}</span><div class="notification-copy"><div class="notification-heading"><strong>${escapeHtml(title)}</strong><time>${escapeHtml(n.time || 'Recent')}</time></div><div class="notification-source"><span>${escapeHtml(app)}</span><code title="Android package">${escapeHtml(n.package)}</code></div>${preview ? `<p>${escapeHtml(preview)}</p>` : ''}</div></article>`;
    }).join('')}</div>` : empty('No active notifications', 'The device did not report any currently posted notifications.')}</section>`;
  }
  async function renderStorage() {
    const t = state.telemetry || {};
    if (state.filesView !== 'explorer') {
      if (state.storageVolumesSerial !== state.serial) {
        try { state.storageVolumes = await invokeOrFail('adb_storage_volumes', { serial: state.serial }); }
        catch { state.storageVolumes = []; }
        state.storageVolumesSerial = state.serial;
      }
      const volumes = state.storageVolumes?.length ? state.storageVolumes : (t.storage_internal_total_gb != null ? [{ name: 'Internal storage', path: '/sdcard', total_kb: t.storage_internal_total_gb * 1024 * 1024, free_kb: (t.storage_internal_free_gb || 0) * 1024 * 1024 }] : []);
      content.innerHTML = `<div class="files-home"><header class="files-home-heading"><div><h2>Storage locations</h2><span class="subtle">${volumes.length} mounted ${volumes.length === 1 ? 'volume' : 'volumes'}</span></div></header><div class="files-drive-grid">${volumes.map((volume, index) => { const total = volume.total_kb / 1024 / 1024, free = volume.free_kb / 1024 / 1024, usedPct = total ? Math.max(0, Math.min(100, 100 * (total - free) / total)) : 0; return `<button class="files-drive-card" data-storage-volume="${index}"><span class="files-drive-icon">${icon("e0c5")}</span><span class="files-drive-copy"><b>${escapeHtml(volume.name)}</b><span>${free.toFixed(1)} GB free of ${total.toFixed(1)} GB</span><i><em style="width:${usedPct}%"></em></i></span><span class="files-drive-chevron">${icon("e0a6")}</span></button>`; }).join('') || empty('No storage volumes', 'The device did not report any browseable storage.')}</div></div>`;
      document.querySelectorAll('[data-storage-volume]').forEach((button) => button.onclick = () => {
        const volume = volumes[Number(button.dataset.storageVolume)];
        state.storageRootPath = volume.path; state.path = volume.path; state.filesView = 'explorer'; state.filesSelectedPath = '';
        showPageLoading('Files'); void renderTab();
      });
      return;
    }

    const rows = state.data || [];
    const normalizedPath = state.path.replace(/\/$/, '') || '/';
    const byPath = new Map(rows.map((file) => [`${normalizedPath}/${file.name}`, file]));
    const selected = byPath.get(state.filesSelectedPath);
    const visibleRows = rows.filter((file) => (state.filesShowHidden || !file.name.startsWith('.')) && file.name.toLowerCase().includes(state.filesSearch.toLowerCase()));
    const extension = (name) => name.split('.').pop().toLowerCase();
    visibleRows.sort((a, b) => {
      if (a.directory !== b.directory) return a.directory ? -1 : 1;
      if (state.filesSort === 'size') return b.bytes - a.bytes;
      if (state.filesSort === 'type') return extension(a.name).localeCompare(extension(b.name)) || a.name.localeCompare(b.name);
      if (state.filesSort === 'modified-newest') return b.modified.localeCompare(a.modified);
      if (state.filesSort === 'modified-oldest') return a.modified.localeCompare(b.modified);
      return state.filesSort === 'name-desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name);
    });
    const openPath = (path) => { state.path = path; state.filesSelectedPath = ''; showPageLoading('Files'); void renderTab(); };
    const imageExt = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp']);
    content.innerHTML = `<div class="files-browser"><div class="files-sticky-bar">
      <button class="button" id="files-home">${icon('e0d7')} Drives</button>
      <button class="button files-up-button" id="file-up" title="Parent folder">Up</button>
      <form id="path-form"><input id="file-path" class="input mono" value="${escapeHtml(state.path)}" aria-label="Current folder path"><button class="button" title="Go to path">${icon('e0a6')}</button></form>
      <div class="files-search-wrap"><button class="button files-search-toggle" id="files-search-toggle" title="Search files" aria-label="Search files">${icon('e151')}</button><label class="files-search" ${state.filesSearchOpen ? '' : 'hidden'}><input id="files-search" type="search" value="${escapeHtml(state.filesSearch)}" placeholder="Search files" aria-label="Search files"></label></div>
      <div class="files-actions"><button class="button tonal" id="files-import" ${state.filesExporting ? 'disabled' : ''}>${icon('e0cc')} Import</button><button class="button tonal" id="files-export" ${selected && !state.filesExporting ? '' : 'disabled'}>${icon('e0cc')} Export</button><div class="files-menu-wrap"><button class="button files-menu-trigger" id="files-menu-trigger" title="View options" aria-label="View options">${icon('e0b7')}</button>
        <div class="files-options" id="files-options" hidden><div class="files-options-row"><span>Icon size</span><button data-size="-">−</button><button data-size="+">+</button></div><label>Sort<select id="files-sort"><option value="name-asc">A–Z</option><option value="name-desc">Z–A</option><option value="modified-newest">Last Modified</option><option value="modified-oldest">First Modified</option><option value="size">Size</option><option value="type">Type</option></select></label><label class="files-hidden-toggle"><input id="files-hidden" type="checkbox" ${state.filesShowHidden ? 'checked' : ''}> Show Hidden Files</label></div></div></div></div>
      <div class="files-grid" style="--file-icon-size:${state.filesIconSize}px">${visibleRows.length ? visibleRows.map((file) => { const path = `${normalizedPath}/${file.name}`, isImage = !file.directory && imageExt.has(extension(file.name)) && file.bytes <= 24 * 1024 * 1024; return `<button class="files-entry ${state.filesSelectedPath === path ? 'selected' : ''}" data-file-path="${escapeHtml(path)}" data-directory="${file.directory}"><span class="files-entry-icon ${file.directory ? 'folder' : 'file'}">${file.directory ? icon('e0d7') : isImage ? `<img data-file-thumb="${escapeHtml(path)}" alt="">` : icon('e0cc')}</span><span class="files-entry-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span></button>`; }).join('') : `<div class="files-empty">${empty(state.filesSearch ? 'No matching files' : 'Folder is empty', state.filesSearch ? 'Try another search.' : 'Choose another folder or import a file.')}</div>`}</div>
      ${state.filesExporting ? `<div class="files-transfer"><span>${icon('e0cc')} Exporting ${escapeHtml(state.filesExporting)}</span><i><em></em></i></div>` : ''}</div>`;
    $('#files-sort').value = state.filesSort;
    $('#files-home').onclick = () => { state.filesView = 'drives'; state.filesSelectedPath = ''; renderStorage(); };
    $('#file-up').onclick = () => {
      if (state.path === state.storageRootPath) { state.filesView = 'drives'; renderStorage(); return; }
      const parent = state.path.replace(/\/$/, '').split('/').slice(0, -1).join('/') || '/';
      openPath(parent);
    };
    $('#path-form').onsubmit = (event) => { event.preventDefault(); openPath($('#file-path').value.trim() || state.storageRootPath); };
    $('#files-search-toggle').onclick = () => { state.filesSearchOpen = !state.filesSearchOpen; renderStorage(); if (state.filesSearchOpen) $('#files-search').focus(); };
    $('#files-search')?.addEventListener('input', (event) => {
      state.filesSearch = event.target.value;
      const query = state.filesSearch.toLowerCase();
      document.querySelectorAll('[data-file-path]').forEach((entry) => { entry.hidden = !entry.querySelector('.files-entry-name').textContent.toLowerCase().includes(query); });
    });
    $('#files-menu-trigger').onclick = () => { $('#files-options').hidden = !$('#files-options').hidden; };
    $('#files-sort').onchange = (event) => { state.filesSort = event.target.value; renderStorage(); $('#files-options').hidden = false; };
    $('#files-hidden').onchange = (event) => { state.filesShowHidden = event.target.checked; renderStorage(); $('#files-options').hidden = false; };
    document.querySelectorAll('[data-size]').forEach((button) => button.onclick = () => {
      state.filesIconSize = Math.max(56, Math.min(160, state.filesIconSize + (button.dataset.size === '+' ? 16 : -16)));
      renderStorage(); $('#files-options').hidden = false;
    });
    const showFile = async (path) => {
      const file = byPath.get(path);
      if (file?.directory) { openPath(path); return; }
      try {
        const image = await invokeOrFail('adb_photo_preview', { serial: state.serial, path });
        const preview = document.createElement('div');
        preview.className = 'files-preview';
        preview.innerHTML = `<button class="button files-preview-close" aria-label="Close">Close</button><img src="${image}" alt="${escapeHtml(file?.name || path)}">`;
        preview.onclick = (event) => { if (event.target === preview || event.target.closest('.files-preview-close')) preview.remove(); };
        document.body.append(preview);
      } catch { toast('Preview is available for image files. Use Export for other file types.', true); }
    };
    const refreshFiles = async () => {
      state.data = await invokeOrFail('adb_data', { serial: state.serial, section: 'files', path: state.path });
      renderStorage();
    };
    const runFileAction = async (fileAction, source, destination = '') => {
      await action(fileAction, source, destination);
      await refreshFiles();
    };
    document.querySelectorAll('[data-file-path]').forEach((button) => {
      button.onclick = () => { state.filesSelectedPath = button.dataset.filePath; renderStorage(); };
      button.ondblclick = () => void showFile(button.dataset.filePath);
      button.oncontextmenu = (event) => {
        event.preventDefault();
        const path = button.dataset.filePath, file = byPath.get(path), isDirectory = button.dataset.directory === 'true';
        document.querySelector('.files-context-menu')?.remove();
        const menu = document.createElement('div');
        menu.className = 'files-context-menu';
        menu.style.left = `${Math.max(4, Math.min(event.clientX, innerWidth - 200))}px`;
        menu.style.top = `${Math.max(4, Math.min(event.clientY, innerHeight - 310))}px`;
        menu.innerHTML = `<button data-file-command="open">Open</button><button data-file-command="copy">Copy</button><button data-file-command="cut">Cut</button><button data-file-command="paste" ${state.filesClipboard ? '' : 'disabled'}>Paste</button><button data-file-command="rename">Rename</button><button data-file-command="delete" class="danger">Delete</button><button data-file-command="export">Export</button>`;
        document.body.append(menu);
        const close = (outside) => { if (!menu.contains(outside.target)) { menu.remove(); window.removeEventListener('pointerdown', close); } };
        window.addEventListener('pointerdown', close);
        menu.onclick = async (click) => {
          try {
          click.stopPropagation();
          const command = click.target.closest('[data-file-command]')?.dataset.fileCommand;
          if (!command || click.target.closest('button').disabled) return;
          menu.remove(); window.removeEventListener('pointerdown', close);
          state.filesSelectedPath = path;
          if (command === 'open') { await showFile(path); return; }
          if (command === 'copy' || command === 'cut') { state.filesClipboard = { path, cut: command === 'cut' }; renderStorage(); toast(command === 'copy' ? 'Ready to copy' : 'Ready to move'); return; }
          if (command === 'delete') {
            if (confirm(`Delete ${file.name} from the device?`)) await runFileAction('delete_file', path);
            return;
          }
          if (command === 'rename') {
            const name = prompt('Rename to:', file.name)?.trim();
            if (name && name !== file.name && !/[\\/]/.test(name) && !['.', '..'].includes(name)) await runFileAction('move_file', path, `${normalizedPath}/${name}`);
            return;
          }
          if (command === 'paste' && state.filesClipboard) {
            const destination = `${isDirectory ? path : normalizedPath}/`;
            await runFileAction(state.filesClipboard.cut ? 'move_file' : 'copy_file', state.filesClipboard.path, destination);
            if (state.filesClipboard.cut) { state.filesClipboard = null; renderStorage(); }
            return;
          }
          if (command === 'export') await exportPath(path, file.name);
          } catch { /* The shared action helper already reports transfer errors. */ }
        };
      };
    });
    const thumbNodes = [...document.querySelectorAll('[data-file-thumb]')];
    state.filesThumbObserver?.disconnect();
    const thumbnailSerial = state.serial;
    const loadingThumbs = state.filesThumbLoading;
    state.filesThumbObserver = new IntersectionObserver((entries) => entries.forEach(async (entry) => {
      if (!entry.isIntersecting) return;
      const image = entry.target, path = image.dataset.fileThumb;
      state.filesThumbObserver?.unobserve(image);
      if (state.filesThumbs[path]) { image.src = state.filesThumbs[path]; return; }
      if (loadingThumbs.has(path)) return;
      loadingThumbs.add(path);
      try {
        const thumbnail = await invokeOrFail('adb_photo_thumbnail', { serial: thumbnailSerial, path });
        if (thumbnailSerial === state.serial) state.filesThumbs[path] = thumbnail;
        if (image.isConnected) image.src = thumbnail;
      } catch { if (image.isConnected) image.parentElement.innerHTML = icon('e0cc'); }
      finally { loadingThumbs.delete(path); }
    }), { root: content, rootMargin: '160px' });
    thumbNodes.forEach((image) => state.filesThumbObserver.observe(image));
    $('#files-import').onclick = async () => {
      try {
        const localPath = await action('pick_file');
        await action('push_file', localPath, `${normalizedPath}/`);
        await refreshFiles();
      } catch (error) { if (!String(error).toLowerCase().includes('cancel')) toast(String(error), true); }
    };
    const exportPath = async (path, name) => {
      try {
        const directory = byPath.get(path)?.directory;
        const destination = directory ? await action('pick_folder') : await action('save_file', name);
        state.filesExporting = name;
        renderStorage();
        await action(directory ? 'pull_folder' : 'pull_file', path, destination);
        toast(`Exported ${name}`);
      } catch (error) { if (!String(error).toLowerCase().includes('cancel')) toast(String(error), true); }
      finally { state.filesExporting = ''; renderStorage(); }
    };
    $('#files-export').onclick = () => selected && void exportPath(state.filesSelectedPath, selected.name);
  }
  function renderApps() {
    const rows = state.data || [];
    content.innerHTML = `<section class="card apps-card"><div class="apps-sticky"><div class="card-head"><div><h2>Installed apps</h2><div class="subtle" style="margin-top:5px">${rows.length} user apps</div></div><button class="button" data-refresh>${icon("e145")} Refresh</button></div><div class="toolbar"><input id="app-filter" class="input" placeholder="Filter package name" aria-label="Filter installed apps"></div></div>${rows.length ? `<div class="installed-app-list">${rows.map((a) => `<article class="app-row installed-app-row"><code class="installed-app-package" title="${escapeHtml(a.name)}">${escapeHtml(a.name)}</code><div class="installed-app-actions"><button class="button tonal" data-action="launch_app" data-value="${escapeHtml(a.name)}">Open</button><button class="button danger" data-action="stop_app" data-value="${escapeHtml(a.name)}">Force stop</button></div></article>`).join('')}</div>` : `<div class="installed-app-empty">${empty('No apps returned', 'Could not read the user app list.')}</div>`}</section>`;
    $('#app-filter').oninput = e => document.querySelectorAll('.app-row').forEach(r => r.hidden = !r.textContent.toLowerCase().includes(e.target.value.toLowerCase()));
  }
  async function renderClipboard() {
    content.innerHTML = `<section class="card"><div class="card-head"><div><h2>Clipboard</h2><div class="subtle" style="margin-top:5px">Read or send text to the Android clipboard</div></div></div><div class="stack"><textarea id="clipboard-text" placeholder="Clipboard text…"></textarea><div class="toolbar"><button id="clipboard-read" class="button">Read device clipboard</button><button id="clipboard-send" class="button primary">Send to device</button></div></div></section>`;
    $('#clipboard-read').onclick = async () => { try { $('#clipboard-text').value = await action('clipboard_get'); } catch {} };
    $('#clipboard-send').onclick = async () => { await action('clipboard_set', $('#clipboard-text').value); };
  }
  function renderTerminal() {
    content.innerHTML = `<section class="card"><div class="card-head"><div><h2>ADB shell</h2><div class="subtle" style="margin-top:5px">Commands run on the selected device over the local ADB bridge.</div></div><button class="button" id="external-adb-shell">${icon('e14f')} Open external shell</button></div><form id="shell-form" class="form-row"><input id="shell-command" class="input mono" placeholder="getprop ro.build.version.release" autocomplete="off"><button class="button primary">Run</button></form><pre id="shell-output" class="console" style="margin-top:14px">Ready. Output appears here.</pre></section>`;
    $('#external-adb-shell').onclick = async () => { try { await action('external_adb_shell'); } catch {} };
    $('#shell-form').onsubmit = async e => { e.preventDefault(); const cmd=$('#shell-command').value.trim(); if(!cmd)return; const out=$('#shell-output'); out.textContent=`$ ${cmd}\nRunning…`; try { out.textContent=`$ ${cmd}\n${await action('shell',cmd) || '(completed)'}`; } catch(err) { out.textContent=`$ ${cmd}\n${err}`; } };
  }
  function renderWireless() {
    const rows=state.data||[];
    content.innerHTML=`<div class="grid two"><section class="card"><div class="card-head"><div><h2>Wireless debugging</h2><div class="subtle" style="margin-top:5px">Switch the selected USB device to ADB over TCP/IP.</div></div></div><div class="stack"><div class="notice">Enabling TCP/IP debugging exposes ADB on the local network until you switch back to USB or reboot. Use this only on a trusted network.</div><div class="toolbar"><button class="button primary" data-action="wireless_on">Enable TCP/IP · 5555</button><button class="button" data-action="wireless_off">Switch back to USB</button><button id="endpoint-refresh" class="button">Refresh addresses</button></div></div></section><section class="card"><div class="card-head"><h2>Device network addresses</h2></div><div class="stack">${rows.length?rows.map(e=>`<article class="list-item"><div class="list-title">${escapeHtml(e.label)}</div><div class="mono muted" style="margin-top:5px">${escapeHtml(e.ip)} · ${escapeHtml(e.interface)}</div></article>`).join(''):empty('No network addresses', 'Connect the device to a network and refresh addresses.')}</div></section></div>`;
    $('#endpoint-refresh').onclick=()=>void renderTab();
  }
  async function renderFirmware() {
    const subtab = state.customSubtab || 'boot';
    const t = state.telemetry || {};

    let subtabHtml = '';

    if (subtab === 'boot') {
      subtabHtml = `
        <div class="boot-modes-grid">
          <div class="boot-mode-card">
            <div class="boot-mode-top">
              <span class="icon" style="color:var(--accent); font-size:18px;">&#xe145;</span>
              <span class="boot-mode-title">System Reboot</span>
            </div>
            <p class="boot-mode-desc">Standard graceful restart of Android OS and running services.</p>
            <button class="boot-mode-btn system" data-reboot-target="system">${icon("e145")} Reboot System</button>
          </div>

          <div class="boot-mode-card">
            <div class="boot-mode-top">
              <span class="icon" style="color:#38bdf8; font-size:18px;">&#xe048;</span>
              <span class="boot-mode-title">Recovery Mode</span>
            </div>
            <p class="boot-mode-desc">Reboot to TWRP, OrangeFox, or Stock Recovery for flashing ROMs, wiping caches, or factory resets.</p>
            <button class="boot-mode-btn recovery" data-reboot-target="recovery">${icon("e048")} Boot Recovery</button>
          </div>

          <div class="boot-mode-card">
            <div class="boot-mode-top">
              <span class="icon" style="color:#fbbf24; font-size:18px;">&#xe0cc;</span>
              <span class="boot-mode-title">Bootloader / Fastboot</span>
            </div>
            <p class="boot-mode-desc">Enter low-level Fastboot mode for partition flashing (boot, recovery, vbmeta) and unlocking.</p>
            <button class="boot-mode-btn bootloader" data-reboot-target="bootloader">${icon("e0cc")} Bootloader (Fastboot)</button>
          </div>

          <div class="boot-mode-card">
            <div class="boot-mode-top">
              <span class="icon" style="color:#c084fc; font-size:18px;">&#xe14f;</span>
              <span class="boot-mode-title">Fastbootd (Dynamic Partitions)</span>
            </div>
            <p class="boot-mode-desc">Userspace fastboot mode on Android 10+ for resizing and flashing dynamic logical partitions.</p>
            <button class="boot-mode-btn fastbootd" data-reboot-target="fastboot">${icon("e14f")} Reboot Fastbootd</button>
          </div>

          <div class="boot-mode-card">
            <div class="boot-mode-top">
              <span class="icon" style="color:#f87171; font-size:18px;">&#xe000;</span>
              <span class="boot-mode-title">EDL Mode (Qualcomm 9008)</span>
            </div>
            <p class="boot-mode-desc">Emergency Download mode for unbricking and deep raw flashing on Qualcomm Snapdragon chipsets.</p>
            <button class="boot-mode-btn edl" data-reboot-target="edl">${icon("e000")} Reboot EDL (9008)</button>
          </div>

          <div class="boot-mode-card">
            <div class="boot-mode-top">
              <span class="icon" style="color:#60a5fa; font-size:18px;">&#xe0b9;</span>
              <span class="boot-mode-title">Sideload Mode</span>
            </div>
            <p class="boot-mode-desc">Directly enter Recovery ADB Sideload state for applying unsigned or signed firmware update zips.</p>
            <button class="boot-mode-btn sideload" data-reboot-target="sideload">${icon("e0b9")} Reboot Sideload</button>
          </div>

          <div class="boot-mode-card">
            <div class="boot-mode-top">
              <span class="icon" style="color:#fb923c; font-size:18px;">&#xe11b;</span>
              <span class="boot-mode-title">Safe Mode</span>
            </div>
            <p class="boot-mode-desc">Boots the system with all third-party applications suppressed to diagnose bootloops and crashes.</p>
            <button class="boot-mode-btn safemode" data-reboot-target="safemode">${icon("e11b")} Boot Safe Mode</button>
          </div>

          <div class="boot-mode-card">
            <div class="boot-mode-top">
              <span class="icon" style="color:#fca5a5; font-size:18px;">&#xe14c;</span>
              <span class="boot-mode-title">Power Off / Shutdown</span>
            </div>
            <p class="boot-mode-desc">Cleanly power down the Android device hardware without initiating a reboot sequence.</p>
            <button class="boot-mode-btn poweroff" id="power-off-btn">${icon("e14c")} Power Off Device</button>
          </div>
        </div>

        <section class="card" style="margin-top:16px;">
          <div class="card-head">
            <div>
              <h3>Hardware & Navigation Emulation</h3>
              <span class="subtle">Inject hardware button events over the ADB bridge</span>
            </div>
          </div>
          <div class="toolbar" style="margin-top:10px;">
            <button class="button" data-action="key_power">${icon("e14c")} Power / Wake</button>
            <button class="button" data-action="key_volume_up">${icon("e145")} Vol +</button>
            <button class="button" data-action="key_volume_down">${icon("e145")} Vol −</button>
            <button class="button tonal" data-action="key_home">${icon("e101")} Home</button>
            <button class="button tonal" data-action="key_back">${icon("e048")} Back</button>
            <button class="button tonal" data-action="key_recents">${icon("e14f")} Recents</button>
          </div>
        </section>
      `;
    } else if (subtab === 'root') {
      const rootStatus = state.customRootStatus;
      const isRooted = rootStatus ? rootStatus.includes('ROOTED') : t.is_rooted;

      subtabHtml = `
        <div class="root-banner">
          <div>
            <div style="display:flex; align-items:center; gap:10px;">
              <span class="root-status-pill ${isRooted ? 'rooted' : 'unrooted'}">
                ● ${isRooted ? 'DEVICE ROOTED (UID 0)' : 'STOCK / UNROOTED'}
              </span>
              <span class="chip mono">SELinux: ${escapeHtml(t.selinux || 'Enforcing')}</span>
            </div>
            <div style="margin-top:6px; color:#cbd5e1; font-size:13px;">
              ${rootStatus ? escapeHtml(rootStatus) : 'Click "Run Root Verification" to detect active su binary, Magisk, KernelSU, or APatch modules.'}
            </div>
          </div>
          <button class="button primary" id="run-root-check-btn">${icon("e145")} Run Root Verification</button>
        </div>

        <div class="tool-grid" style="margin-top:16px;">
          <div class="tool-panel">
            <div class="tool-panel-head">
              <span class="tool-panel-title">${icon("e048")} SELinux Runtime State</span>
              <span class="chip mono" id="selinux-live-chip">${escapeHtml(t.selinux || 'Enforcing')}</span>
            </div>
            <p class="tool-panel-desc">Switch SELinux enforcement without restarting. Permissive mode logs AVC denials without blocking root operations or system modifications.</p>
            <div class="tool-action-row">
              <button class="button tonal" id="selinux-permissive-btn">Set Permissive (0)</button>
              <button class="button" id="selinux-enforcing-btn">Set Enforcing (1)</button>
            </div>
          </div>

          <div class="tool-panel">
            <div class="tool-panel-head">
              <span class="tool-panel-title">${icon("e0d7")} Partition Remount (RW)</span>
            </div>
            <p class="tool-panel-desc">Remount Android <code>/system</code>, <code>/vendor</code>, and <code>/product</code> partitions as Read-Write to allow replacing system files, fonts, or boot animations.</p>
            <div class="tool-action-row">
              <button class="button warning" id="remount-system-btn">${icon("e0cc")} Remount /system as RW</button>
            </div>
          </div>

          <div class="tool-panel" style="grid-column: 1 / -1;">
            <div class="tool-panel-head">
              <span class="tool-panel-title">${icon("e14f")} Superuser Root Shell (su -c)</span>
              <span class="subtle mono">uid=0(root) gid=0(root)</span>
            </div>
            <p class="tool-panel-desc">Execute privileged commands with superuser credentials. Output is captured below.</p>
            <div class="preset-pills" style="margin-bottom:8px;">
              <span style="font-size:11px; color:#64748b; align-self:center;">Quick Commands:</span>
              <button class="preset-pill" data-su-preset="id">id</button>
              <button class="preset-pill" data-su-preset="magisk -v">magisk -v</button>
              <button class="preset-pill" data-su-preset="ls -la /data/adb">ls -la /data/adb</button>
              <button class="preset-pill" data-su-preset="mount | grep system">grep system mount</button>
              <button class="preset-pill" data-su-preset="dmesg | tail -n 25">kernel dmesg</button>
            </div>
            <form id="su-shell-form" class="tool-action-row">
              <input id="su-shell-input" class="input mono" placeholder="su -c id" autocomplete="off">
              <button class="button primary">Run Root Command</button>
            </form>
            <pre id="su-shell-output" class="console" style="min-height:160px; margin-top:8px;">Ready for root shell execution.</pre>
          </div>
        </div>
      `;
    } else if (subtab === 'firmware') {
      subtabHtml = `
        <div class="tool-grid">
          <div class="tool-panel" style="grid-column: 1 / -1;">
            <div class="tool-panel-head">
              <span class="tool-panel-title">${icon("e0cc")} Fastboot Device Bus</span>
              <button class="button tonal" id="scan-fastboot-btn">${icon("e145")} Scan Fastboot Devices</button>
            </div>
            <p class="tool-panel-desc">Check if any connected devices are running in Bootloader, Fastboot, or Fastbootd mode.</p>
            <div id="fastboot-scan-result" class="mono" style="padding:10px 14px; background:var(--well); border-radius:8px; font-size:12px; color:#38bdf8;">
              ${state.customFastbootDevices || 'Click "Scan Fastboot Devices" to query connected fastboot interfaces.'}
            </div>
          </div>

          <div class="tool-panel">
            <div class="tool-panel-head">
              <span class="tool-panel-title">${icon("e0cc")} Sideload OTA Firmware</span>
            </div>
            <p class="tool-panel-desc">Flash official or custom OTA update zip archives onto the device via <code>adb sideload update.zip</code>. The device must be in Recovery Sideload mode.</p>
            <div class="tool-action-row">
              <input id="ota-file-path" class="input mono" placeholder="Path to update.zip..." readonly>
              <button class="button tonal" id="browse-ota-btn">Browse .zip</button>
            </div>
            <button class="button primary" id="flash-ota-btn" style="margin-top:4px;">${icon("e145")} Begin OTA Sideload</button>
          </div>

          <div class="tool-panel">
            <div class="tool-panel-head">
              <span class="tool-panel-title">${icon("e14f")} Fastboot Partition Flasher</span>
            </div>
            <p class="tool-panel-desc">Flash kernel, ramdisk, recovery, or AVB meta partition images (<code>boot.img</code>, <code>recovery.img</code>, <code>vbmeta.img</code>) in fastboot mode.</p>
            <div style="display:flex; gap:8px;">
              <select id="fastboot-partition-select" class="input" style="width:140px;">
                <option value="boot">boot</option>
                <option value="init_boot">init_boot</option>
                <option value="recovery">recovery</option>
                <option value="vbmeta">vbmeta</option>
                <option value="vendor_boot">vendor_boot</option>
                <option value="dtbo">dtbo</option>
                <option value="system">system</option>
              </select>
              <input id="fastboot-img-path" class="input mono" placeholder="Path to image (.img)..." readonly>
              <button class="button tonal" id="browse-fastboot-img-btn">Browse</button>
            </div>
            <button class="button warning" id="flash-fastboot-btn" style="margin-top:4px;">${icon("e0cc")} Flash to Partition</button>
          </div>

          <div class="tool-panel" style="grid-column: 1 / -1;">
            <div class="tool-panel-head">
              <span class="tool-panel-title">${icon("e11b")} Diagnostic Bugreport Generator</span>
              <button class="button success" id="gen-bugreport-btn">${icon("e0cc")} Generate Bugreport ZIP</button>
            </div>
            <p class="tool-panel-desc">Produces a complete system state dump including kernel log ring buffer, tombstone crashes, ANR logs, package metadata, and dumpsys telemetry saved to your PC <code>~/Downloads/</code> directory.</p>
          </div>
        </div>
      `;
    } else if (subtab === 'backup') {
      subtabHtml = `
        <div class="tool-grid">
          <div class="tool-panel">
            <div class="tool-panel-head">
              <span class="tool-panel-title">${icon("e0d7")} Full Device Backup (.ab)</span>
            </div>
            <p class="tool-panel-desc">Creates an Android backup archive (including installed APKs, shared media, and app configurations). The file will be placed in your PC Downloads folder.</p>
            <div class="notice" style="font-size:12px;">You will need to unlock your phone and tap "Back up my data" on the screen prompt to authorize the backup.</div>
            <button class="button primary" id="full-backup-btn" style="margin-top:4px;">${icon("e0cc")} Initiate Full Backup</button>
          </div>

          <div class="tool-panel">
            <div class="tool-panel-head">
              <span class="tool-panel-title">${icon("e14f")} Single Application Backup</span>
            </div>
            <p class="tool-panel-desc">Export a single application's APK and data to an encrypted or plain <code>.ab</code> file.</p>
            <div class="tool-action-row">
              <input id="backup-app-pkg" class="input mono" placeholder="Package name (e.g. com.whatsapp)">
              <button class="button tonal" id="backup-app-btn">Backup App</button>
            </div>
          </div>

          <div class="tool-panel">
            <div class="tool-panel-head">
              <span class="tool-panel-title">${icon("e048")} Live Partition Dumper (Root)</span>
            </div>
            <p class="tool-panel-desc">Extract raw flash block devices directly from <code>/dev/block/by-name/</code> into a pristine <code>.img</code> file on your computer.</p>
            <div class="preset-pills" style="margin-bottom:6px;">
              <span style="font-size:11px; color:#64748b; align-self:center;">Presets:</span>
              <button class="preset-pill" data-part-preset="boot">boot</button>
              <button class="preset-pill" data-part-preset="init_boot">init_boot</button>
              <button class="preset-pill" data-part-preset="recovery">recovery</button>
              <button class="preset-pill" data-part-preset="vbmeta">vbmeta</button>
              <button class="preset-pill" data-part-preset="vendor_boot">vendor_boot</button>
            </div>
            <div class="tool-action-row">
              <input id="dump-partition-name" class="input mono" placeholder="Partition name (e.g. boot)">
              <button class="button warning" id="dump-partition-btn">Dump to PC</button>
            </div>
          </div>

          <div class="tool-panel">
            <div class="tool-panel-head">
              <span class="tool-panel-title">${icon("e145")} Restore Android Backup</span>
            </div>
            <p class="tool-panel-desc">Restore an existing <code>.ab</code> archive back onto the connected Android device.</p>
            <div class="tool-action-row">
              <input id="restore-ab-path" class="input mono" placeholder="Select backup file (.ab)..." readonly>
              <button class="button tonal" id="browse-restore-ab-btn">Browse .ab</button>
            </div>
            <button class="button success" id="execute-restore-btn" style="margin-top:4px;">${icon("e145")} Restore to Device</button>
          </div>
        </div>
      `;
    } else if (subtab === 'tweaks') {
      subtabHtml = `
        <div class="tool-grid">
          <div class="tool-panel">
            <div class="tool-panel-head">
              <span class="tool-panel-title">${icon("e14f")} Display Density (DPI)</span>
              <span class="chip mono">Current: ${escapeHtml(t.screen_dpi || 'Stock')}</span>
            </div>
            <p class="tool-panel-desc">Adjust UI scaling and density live via WindowManager without requiring a reboot.</p>
            <div class="preset-pills" style="margin-bottom:6px;">
              <span style="font-size:11px; color:#64748b; align-self:center;">Presets:</span>
              <button class="preset-pill" data-dpi-val="320">320 (Compact)</button>
              <button class="preset-pill" data-dpi-val="360">360 (Small)</button>
              <button class="preset-pill" data-dpi-val="400">400 (Default)</button>
              <button class="preset-pill" data-dpi-val="440">440 (Large)</button>
              <button class="preset-pill" data-dpi-val="560">560 (Tablet)</button>
            </div>
            <div class="tool-action-row">
              <input id="custom-dpi-input" class="input mono" placeholder="Enter DPI (e.g. 380)" value="${escapeHtml(state.customDensityVal)}">
              <button class="button primary" id="apply-dpi-btn">Apply DPI</button>
              <button class="button tonal" id="reset-dpi-btn">Reset</button>
            </div>
          </div>

          <div class="tool-panel">
            <div class="tool-panel-head">
              <span class="tool-panel-title">${icon("e145")} Snappy Animation Scales</span>
            </div>
            <p class="tool-panel-desc">Speed up window animations, transitions, and animator durations across the entire system UI.</p>
            <div class="preset-pills" style="margin-bottom:10px;">
              <button class="preset-pill ${state.customAnimScale === '0.25' ? 'active' : ''}" data-anim-val="0.25">0.25x (Lightning)</button>
              <button class="preset-pill ${state.customAnimScale === '0.5' ? 'active' : ''}" data-anim-val="0.5">0.5x (Snappy)</button>
              <button class="preset-pill ${state.customAnimScale === '1.0' ? 'active' : ''}" data-anim-val="1.0">1.0x (Stock)</button>
              <button class="preset-pill ${state.customAnimScale === '0.0' ? 'active' : ''}" data-anim-val="0.0">0.0x (Instant / Off)</button>
            </div>
            <button class="button tonal" id="apply-fast-anim-btn">${icon("e145")} Set 0.5x Snappy Speed</button>
          </div>

          <div class="tool-panel" style="grid-column: 1 / -1;">
            <div class="tool-panel-head">
              <span class="tool-panel-title">${icon("e0cc")} Screen Resolution (WindowManager)</span>
              <span class="chip mono">Native: ${escapeHtml(t.screen_res || 'Default')}</span>
            </div>
            <p class="tool-panel-desc">Force custom render resolutions for gaming, battery optimization, or performance testing.</p>
            <div class="preset-pills" style="margin-bottom:8px;">
              <button class="preset-pill" data-res-val="1080x2400">1080x2400 (FHD+)</button>
              <button class="preset-pill" data-res-val="1440x3200">1440x3200 (QHD+)</button>
              <button class="preset-pill" data-res-val="720x1600">720x1600 (HD+ 720p)</button>
              <button class="preset-pill" data-res-val="reset">Reset Native</button>
            </div>
            <div class="tool-action-row" style="max-width:480px;">
              <input id="custom-res-input" class="input mono" placeholder="1080x2400 or reset">
              <button class="button primary" id="apply-res-btn">Set Resolution</button>
            </div>
          </div>
        </div>
      `;
    }

    content.innerHTML = `
      <div class="custom-suite">
        <nav class="custom-subnav">
          <button class="custom-subtab-btn ${subtab === 'boot' ? 'active' : ''}" data-custom-tab="boot">${icon("e145")} Power & Boot Modes</button>
          <button class="custom-subtab-btn ${subtab === 'root' ? 'active' : ''}" data-custom-tab="root">${icon("e048")} Root & Superuser</button>
          <button class="custom-subtab-btn ${subtab === 'firmware' ? 'active' : ''}" data-custom-tab="firmware">${icon("e0cc")} Firmware & Fastboot</button>
          <button class="custom-subtab-btn ${subtab === 'backup' ? 'active' : ''}" data-custom-tab="backup">${icon("e0d7")} Backup & Restore</button>
          <button class="custom-subtab-btn ${subtab === 'tweaks' ? 'active' : ''}" data-custom-tab="tweaks">${icon("e14f")} System Tweaks</button>
        </nav>
        ${subtabHtml}
      </div>
    `;

    document.querySelectorAll('[data-custom-tab]').forEach(btn => {
      btn.onclick = () => {
        state.customSubtab = btn.dataset.customTab;
        renderFirmware();
      };
    });

    document.querySelectorAll('[data-reboot-target]').forEach(btn => {
      btn.onclick = async () => {
        const target = btn.dataset.rebootTarget;
        if (confirm(`Reboot device into ${target.toUpperCase()} mode? The device may briefly disconnect.`)) {
          await action('reboot', target);
        }
      };
    });

    const powerOffBtn = $('#power-off-btn');
    if (powerOffBtn) {
      powerOffBtn.onclick = async () => {
        if (confirm('Power off the Android device hardware?')) {
          await action('shell', 'reboot -p');
          toast('Power off command sent.');
        }
      };
    }

    const runRootCheckBtn = $('#run-root-check-btn');
    if (runRootCheckBtn) {
      runRootCheckBtn.onclick = async () => {
        toast('Checking root status and superuser binaries...');
        try {
          const res = await action('root_check');
          state.customRootStatus = res;
          renderFirmware();
        } catch (err) {
          toast(String(err), true);
        }
      };
    }

    const selinuxPermBtn = $('#selinux-permissive-btn');
    if (selinuxPermBtn) {
      selinuxPermBtn.onclick = async () => {
        try {
          await action('set_selinux', '0');
          const chip = $('#selinux-live-chip');
          if (chip) chip.textContent = 'Permissive';
        } catch (e) { toast(String(e), true); }
      };
    }

    const selinuxEnfBtn = $('#selinux-enforcing-btn');
    if (selinuxEnfBtn) {
      selinuxEnfBtn.onclick = async () => {
        try {
          await action('set_selinux', '1');
          const chip = $('#selinux-live-chip');
          if (chip) chip.textContent = 'Enforcing';
        } catch (e) { toast(String(e), true); }
      };
    }

    const remountBtn = $('#remount-system-btn');
    if (remountBtn) {
      remountBtn.onclick = async () => {
        try {
          const res = await action('remount_system');
          toast(res || 'Remount command completed');
        } catch (e) { toast(String(e), true); }
      };
    }

    document.querySelectorAll('[data-su-preset]').forEach(btn => {
      btn.onclick = () => {
        const input = $('#su-shell-input');
        if (input) { input.value = btn.dataset.suPreset; input.focus(); }
      };
    });

    const suForm = $('#su-shell-form');
    if (suForm) {
      suForm.onsubmit = async (e) => {
        e.preventDefault();
        const cmd = $('#su-shell-input').value.trim();
        if (!cmd) return;
        const out = $('#su-shell-output');
        out.textContent = `# su -c "${cmd}"\nExecuting with UID 0...`;
        try {
          const res = await action('shell', `su -c "${cmd}"`);
          out.textContent = `# su -c "${cmd}"\n${res || '(no output / completed)'}`;
        } catch (err) {
          out.textContent = `# su -c "${cmd}"\nError: ${err}`;
        }
      };
    }

    const scanFastbootBtn = $('#scan-fastboot-btn');
    if (scanFastbootBtn) {
      scanFastbootBtn.onclick = async () => {
        try {
          const res = await action('fastboot_devices');
          state.customFastbootDevices = res;
          const box = $('#fastboot-scan-result');
          if (box) box.textContent = res;
        } catch (err) { toast(String(err), true); }
      };
    }

    const browseOtaBtn = $('#browse-ota-btn');
    if (browseOtaBtn) {
      browseOtaBtn.onclick = async () => {
        try {
          const p = await action('pick_file', 'zip');
          if (p) $('#ota-file-path').value = p;
        } catch {}
      };
    }

    const flashOtaBtn = $('#flash-ota-btn');
    if (flashOtaBtn) {
      flashOtaBtn.onclick = async () => {
        const p = $('#ota-file-path').value.trim();
        if (!p) { toast('Please browse and select an OTA .zip file first.', true); return; }
        if (confirm(`Begin ADB sideload of:\n${p}\n\nEnsure device is in Recovery Sideload mode!`)) {
          toast('Starting OTA sideload, please wait...');
          try {
            const res = await action('sideload_ota', p);
            toast(res || 'OTA Sideload complete!');
          } catch (err) { toast(String(err), true); }
        }
      };
    }

    const browseFastbootImgBtn = $('#browse-fastboot-img-btn');
    if (browseFastbootImgBtn) {
      browseFastbootImgBtn.onclick = async () => {
        try {
          const p = await action('pick_file', 'img');
          if (p) $('#fastboot-img-path').value = p;
        } catch {}
      };
    }

    const flashFastbootBtn = $('#flash-fastboot-btn');
    if (flashFastbootBtn) {
      flashFastbootBtn.onclick = async () => {
        const part = $('#fastboot-partition-select').value;
        const img = $('#fastboot-img-path').value.trim();
        if (!img) { toast('Please select an image file (.img) to flash.', true); return; }
        if (confirm(`Flash image:\n${img}\n\nTo partition [${part}] in fastboot mode?`)) {
          toast(`Flashing ${part}...`);
          try {
            const res = await action('fastboot_flash', part, img);
            toast(res || `Fastboot flash to ${part} finished!`);
          } catch (err) { toast(String(err), true); }
        }
      };
    }

    const bugreportBtn = $('#gen-bugreport-btn');
    if (bugreportBtn) {
      bugreportBtn.onclick = async () => {
        toast('Generating comprehensive bugreport (this may take 20-30 seconds)...');
        try {
          const res = await action('bugreport');
          toast(res || 'Bugreport saved to Downloads folder!');
        } catch (err) { toast(String(err), true); }
      };
    }

    const fullBackupBtn = $('#full-backup-btn');
    if (fullBackupBtn) {
      fullBackupBtn.onclick = async () => {
        try {
          const res = await action('backup_full');
          toast(res || 'Backup started - check phone display!');
        } catch (err) { toast(String(err), true); }
      };
    }

    const backupAppBtn = $('#backup-app-btn');
    if (backupAppBtn) {
      backupAppBtn.onclick = async () => {
        const pkg = $('#backup-app-pkg').value.trim();
        if (!pkg) { toast('Enter a package name (e.g. com.example.app)', true); return; }
        try {
          const res = await action('backup_app', pkg);
          toast(res || 'App backup started!');
        } catch (err) { toast(String(err), true); }
      };
    }

    document.querySelectorAll('[data-part-preset]').forEach(btn => {
      btn.onclick = () => {
        const input = $('#dump-partition-name');
        if (input) { input.value = btn.dataset.partPreset; input.focus(); }
      };
    });

    const dumpPartBtn = $('#dump-partition-btn');
    if (dumpPartBtn) {
      dumpPartBtn.onclick = async () => {
        const part = $('#dump-partition-name').value.trim();
        if (!part) { toast('Enter or select a partition name to dump', true); return; }
        toast(`Dumping /dev/block/by-name/${part} to PC Downloads...`);
        try {
          const res = await action('dump_partition', part);
          toast(res || `Partition ${part} dumped successfully!`);
        } catch (err) { toast(String(err), true); }
      };
    }

    const browseRestoreBtn = $('#browse-restore-ab-btn');
    if (browseRestoreBtn) {
      browseRestoreBtn.onclick = async () => {
        try {
          const p = await action('pick_file', 'ab');
          if (p) $('#restore-ab-path').value = p;
        } catch {}
      };
    }

    const executeRestoreBtn = $('#execute-restore-btn');
    if (executeRestoreBtn) {
      executeRestoreBtn.onclick = async () => {
        const p = $('#restore-ab-path').value.trim();
        if (!p) { toast('Browse and select an .ab backup file first', true); return; }
        if (confirm(`Restore backup archive:\n${p}\n\nConfirm prompt on phone screen when prompted.`)) {
          try {
            const res = await action('restore_backup', p);
            toast(res || 'Restore command sent!');
          } catch (err) { toast(String(err), true); }
        }
      };
    }

    document.querySelectorAll('[data-dpi-val]').forEach(btn => {
      btn.onclick = () => {
        const input = $('#custom-dpi-input');
        if (input) input.value = btn.dataset.dpiVal;
      };
    });

    const applyDpiBtn = $('#apply-dpi-btn');
    if (applyDpiBtn) {
      applyDpiBtn.onclick = async () => {
        const val = $('#custom-dpi-input').value.trim();
        if (!val) return;
        state.customDensityVal = val;
        try {
          await action('set_density', val);
          toast(`Display density set to ${val} DPI`);
        } catch (err) { toast(String(err), true); }
      };
    }

    const resetDpiBtn = $('#reset-dpi-btn');
    if (resetDpiBtn) {
      resetDpiBtn.onclick = async () => {
        try {
          await action('set_density', 'reset');
          toast('Display density reset to default stock value');
        } catch (err) { toast(String(err), true); }
      };
    }

    document.querySelectorAll('[data-anim-val]').forEach(btn => {
      btn.onclick = async () => {
        const scale = btn.dataset.animVal;
        state.customAnimScale = scale;
        try {
          await action('set_animations', scale);
          toast(`Animation scales set to ${scale}x`);
          renderFirmware();
        } catch (err) { toast(String(err), true); }
      };
    });

    const applyFastAnimBtn = $('#apply-fast-anim-btn');
    if (applyFastAnimBtn) {
      applyFastAnimBtn.onclick = async () => {
        state.customAnimScale = '0.5';
        try {
          await action('set_animations', '0.5');
          toast('Applied 0.5x snappy animation scales');
          renderFirmware();
        } catch (err) { toast(String(err), true); }
      };
    }

    document.querySelectorAll('[data-res-val]').forEach(btn => {
      btn.onclick = () => {
        const input = $('#custom-res-input');
        if (input) input.value = btn.dataset.resVal;
      };
    });

    const applyResBtn = $('#apply-res-btn');
    if (applyResBtn) {
      applyResBtn.onclick = async () => {
        const v = $('#custom-res-input').value.trim();
        if (!v) return;
        try {
          if (v === 'reset') {
            await action('shell', 'wm size reset');
            toast('Screen resolution reset to native');
          } else {
            await action('shell', `wm size ${v}`);
            toast(`Screen resolution set to ${v}`);
          }
        } catch (err) { toast(String(err), true); }
      };
    }
  }
  function formatRate(value) {
    if (value == null || !Number.isFinite(Number(value))) return '0 B/s';
    const num = Number(value);
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    let n = Math.abs(num), i = 0;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    const sign = num < 0 ? '-' : '';
    return `${sign}${n.toFixed(i ? 1 : 0)} ${units[i]}`;
  }

  function formatBytes(value) {
    if (value == null || !Number.isFinite(Number(value))) return '0 B';
    const num = Number(value);
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let n = Math.abs(num), i = 0;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    const sign = num < 0 ? '-' : '';
    return `${sign}${n.toFixed(i ? 1 : 0)} ${units[i]}`;
  }

  function recordSensorSample(s) {
    if (!s || typeof s !== 'object') return;
    state.sensorHistorySerial = state.serial;
    const previous = state.sensorHistory.at(-1), now = Date.now();
    const sum = (items, key) => (items || []).reduce((n, item) => n + (Number(item[key]) || 0), 0);
    const sumNetwork = (match, key) => sum((s.network_interfaces || []).filter((iface) => match.test(iface.name)), key);
    const mem = s.mem_total_kb ? 100 * (s.mem_total_kb - (s.mem_available_kb || 0)) / s.mem_total_kb : null;
    const diskTotal = s.storage_internal_total_kb, diskFree = s.storage_internal_free_kb;
    const rx = sum(s.network_interfaces, 'rx_bytes'), tx = sum(s.network_interfaces, 'tx_bytes');
    const wifiRx = sumNetwork(/^(wlan|wifi)/i, 'rx_bytes'), wifiTx = sumNetwork(/^(wlan|wifi)/i, 'tx_bytes');
    const mobileRx = sumNetwork(/^(rmnet|ccmni|wwan|pdp)/i, 'rx_bytes'), mobileTx = sumNetwork(/^(rmnet|ccmni|wwan|pdp)/i, 'tx_bytes');
    const diskRead = sum(s.disk_counters, 'read_sectors'), diskWrite = sum(s.disk_counters, 'written_sectors');
    const seconds = previous ? Math.max(0.1, (now - previous.at) / 1000) : 0;
    const rate = (current, old) => previous && current >= old && seconds > 0 ? (current - old) / seconds : 0;
    const temps = s.temperatures || [];
    const cores = {};
    let procCpu = null;
    for (const c of s.cpu_counters || []) {
      if (c.name === 'cpu') {
        const oldTotal = previous?.cpuCounters?.cpu?.total, oldIdle = previous?.cpuCounters?.cpu?.idle;
        if (oldTotal != null && c.total > oldTotal && c.idle >= oldIdle) {
          procCpu = Number((100 * (1 - (c.idle - oldIdle) / (c.total - oldTotal))).toFixed(1));
        }
        continue;
      }
      if (!previous) continue;
      const old = (previous.cpuCounters || {})[c.name];
      if (old && c.total > old.total && c.idle >= old.idle) {
        cores[c.name] = Number((100 * (1 - (c.idle - old.idle) / (c.total - old.total))).toFixed(1));
      }
    }
    const socketTotal = Number(s.socket_total) || 0;
    const socketTcp = Number(s.socket_tcp) || 0;
    const socketUdp = Number(s.socket_udp) || 0;
    const rxRate = rate(rx, previous?.rx ?? rx);
    const txRate = rate(tx, previous?.tx ?? tx);
    const diskReadRate = rate(diskRead, previous?.diskRead ?? diskRead) * 512;
    const diskWriteRate = rate(diskWrite, previous?.diskWrite ?? diskWrite) * 512;

    state.sensorHistory.push({
      at: now,
      powerAttribution: s.power_attribution || [],
      powerAttributionSecs: s.power_attribution_secs,
      cpu: Number((s.cpu_usage_pct ?? procCpu ?? 0).toFixed(1)),
      ram: Number((mem ?? 0).toFixed(1)),
      swap: Number((s.swap_total_kb ? 100 * (s.swap_total_kb - (s.swap_free_kb || 0)) / s.swap_total_kb : 0).toFixed(1)),
      storage: Number((diskTotal && diskFree != null ? 100 * (diskTotal - diskFree) / diskTotal : 0).toFixed(1)),
      rx, tx,
      wifiRx, wifiTx, mobileRx, mobileTx,
      wifiRxRate: Number(rate(wifiRx, previous?.wifiRx ?? wifiRx).toFixed(1)), wifiTxRate: Number(rate(wifiTx, previous?.wifiTx ?? wifiTx).toFixed(1)),
      mobileRxRate: Number(rate(mobileRx, previous?.mobileRx ?? mobileRx).toFixed(1)), mobileTxRate: Number(rate(mobileTx, previous?.mobileTx ?? mobileTx).toFixed(1)),
      rxRate: Number(rxRate.toFixed(1)),
      txRate: Number(txRate.toFixed(1)),
      diskReadRate: Number(diskReadRate.toFixed(1)),
      diskWriteRate: Number(diskWriteRate.toFixed(1)),
      battery: Number((s.battery_pct ?? 0).toFixed(0)),
      temp: Number((temps.length ? Math.max(...temps.map(x => Number(x.temp_c)).filter(Number.isFinite)) : (s.battery_temp_c ?? 0)).toFixed(1)),
      cores,
      cpuCounters: Object.fromEntries((s.cpu_counters || []).map(c => [c.name, { total: c.total, idle: c.idle }])),
      diskRead, diskWrite,
      socketTotal, socketTcp, socketUdp
    });
    if (state.sensorHistory.length > 60) state.sensorHistory.shift();
  }

  function renderSparklineSvg(data = [], maxVal = 100, dottedRatio = 0.5, color = 'var(--accent)') {
    const pointsData = (data.length === 1 ? [data[0], data[0]] : data).map(v => Number(v)).filter(Number.isFinite);
    if (pointsData.length < 2) {
      return `<svg class="stat-card-spark" viewBox="0 0 100 48" preserveAspectRatio="none"><line x1="0" y1="24" x2="100" y2="24" stroke="rgba(255,255,255,0.06)" stroke-width="1.5"/></svg>`;
    }
    const max = Math.max(maxVal || 1, ...pointsData);
    const min = Math.min(0, ...pointsData);
    const range = max - min || 1;
    const n = pointsData.length;
    const stepX = 100 / (n - 1);
    const pts = pointsData.map((v, i) => {
      const x = (i * stepX).toFixed(1);
      const norm = Math.max(0.02, Math.min(0.96, (v - min) / range));
      const y = (46 - norm * 42).toFixed(1);
      return `${x},${y}`;
    }).join(' ');

    const gradId = 'spk-' + Math.random().toString(36).slice(2, 7);
    const dottedLine = dottedRatio != null
      ? `<line x1="0" y1="${(46 - Math.max(0.05, Math.min(0.95, dottedRatio)) * 42).toFixed(1)}" x2="100" y2="${(46 - Math.max(0.05, Math.min(0.95, dottedRatio)) * 42).toFixed(1)}" stroke="${color}" stroke-opacity="0.4" stroke-dasharray="3,3" stroke-width="1.2"/>`
      : '';

    return `
      <svg class="stat-card-spark" viewBox="0 0 100 48" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${color}" stop-opacity="0.38"/>
            <stop offset="100%" stop-color="${color}" stop-opacity="0.02"/>
          </linearGradient>
        </defs>
        ${dottedLine}
        <polygon points="0,48 ${pts} 100,48" fill="url(#${gradId})"/>
        <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
      </svg>
    `;
  }

  function renderBigStatCard({ iconCode, title, heroVal, heroUnit = '', subtitle = '', leftStat = '', rightStat = '', data = [], maxVal = 100, dottedRatio = 0.5, color = 'var(--accent)' }) {
    const spark = renderSparklineSvg(data, maxVal, dottedRatio, color);
    return `
      <article class="sensors-stat-card">
        <div class="stat-card-title"><span class="icon">${icon(iconCode)}</span><span>${escapeHtml(title)}</span></div>
        <div class="stat-card-hero">
          <span class="stat-hero-val">${escapeHtml(heroVal)}</span>
          ${heroUnit ? `<span class="stat-hero-unit">${escapeHtml(heroUnit)}</span>` : ''}
        </div>
        <div class="stat-card-sub" title="${escapeHtml(subtitle)}">${escapeHtml(subtitle)}</div>
        <div class="stat-card-range">
          <span>${escapeHtml(leftStat)}</span>
          <span>${escapeHtml(rightStat)}</span>
        </div>
        <div class="stat-card-spark">${spark}</div>
      </article>
    `;
  }

  function renderDualNetworkSvg(txHistory = [], rxHistory = [], peakVal = 0, accentColor = 'var(--accent)') {
    const n = Math.max(txHistory.length, rxHistory.length);
    const h = 190, w = 600;
    if (n < 2) {
      return `<div class="chart-empty">Collecting network telemetry samples…</div>`;
    }
    const maxV = Math.max(peakVal || 0, ...txHistory, ...rxHistory, 1024);
    const stepX = (w - 24) / (n - 1);
    const yBase = h - 18;
    const yTop = 16;
    const graphH = yBase - yTop;

    const toPoints = (series) => series.map((v, i) => {
      const x = (12 + i * stepX).toFixed(1);
      const norm = Math.max(0.02, Math.min(0.94, (Number(v) || 0) / maxV));
      const y = (yBase - norm * graphH).toFixed(1);
      return `${x},${y}`;
    });

    const txPts = toPoints(txHistory);
    const rxPts = toPoints(rxHistory);

    const txPoly = txPts.join(' ');
    const rxPoly = rxPts.join(' ');

    const txArea = `12,${yBase} ${txPoly} ${12 + (txHistory.length - 1) * stepX},${yBase}`;
    const rxArea = `12,${yBase} ${rxPoly} ${12 + (rxHistory.length - 1) * stepX},${yBase}`;

    const gradTx = 'dnet-tx-' + Math.random().toString(36).slice(2, 7);
    const gradRx = 'dnet-rx-' + Math.random().toString(36).slice(2, 7);
    const yPeak = (yTop + graphH * 0.28).toFixed(1);

    return `
      <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Network throughput history" preserveAspectRatio="none" style="width:100%;height:${h}px;display:block;">
        <defs>
          <linearGradient id="${gradTx}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.36"/>
            <stop offset="100%" stop-color="${accentColor}" stop-opacity="0.02"/>
          </linearGradient>
          <linearGradient id="${gradRx}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.22"/>
            <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.01"/>
          </linearGradient>
        </defs>
        <line x1="12" y1="${yBase}" x2="${w - 12}" y2="${yBase}" stroke="rgba(255,255,255,0.08)" stroke-width="1.2"/>
        <line x1="12" y1="${yPeak}" x2="${w - 12}" y2="${yPeak}" stroke="${accentColor}" stroke-opacity="0.5" stroke-dasharray="6,4" stroke-width="1.4"/>
        <polygon points="${rxArea}" fill="url(#${gradRx})"/>
        <polyline points="${rxPoly}" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        <polygon points="${txArea}" fill="url(#${gradTx})"/>
        <polyline points="${txPoly}" fill="none" stroke="${accentColor}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }

  function renderSocketsChartSvg(tcpHistory = [], udpHistory = [], accentColor = 'var(--accent)') {
    const n = Math.max(tcpHistory.length, udpHistory.length);
    const h = 190, w = 450;
    if (n < 2) {
      return `<div class="chart-empty">Collecting socket telemetry…</div>`;
    }
    const maxV = Math.max(10, ...tcpHistory, ...udpHistory);
    const stepX = (w - 24) / (n - 1);
    const yBase = h - 18;
    const yTop = 16;
    const graphH = yBase - yTop;

    const toPoints = (series) => series.map((v, i) => {
      const x = (12 + i * stepX).toFixed(1);
      const norm = Math.max(0.04, Math.min(0.92, (Number(v) || 0) / maxV));
      const y = (yBase - norm * graphH).toFixed(1);
      return `${x},${y}`;
    });

    const tcpPts = toPoints(tcpHistory);
    const udpPts = toPoints(udpHistory);

    const tcpPoly = tcpPts.join(' ');
    const udpPoly = udpPts.join(' ');

    const tcpArea = `12,${yBase} ${tcpPoly} ${12 + (tcpHistory.length - 1) * stepX},${yBase}`;
    const gradTcp = 'sock-tcp-' + Math.random().toString(36).slice(2, 7);
    const yMid = (yTop + graphH * 0.45).toFixed(1);

    return `
      <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Sockets history" preserveAspectRatio="none" style="width:100%;height:${h}px;display:block;">
        <defs>
          <linearGradient id="${gradTcp}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.36"/>
            <stop offset="100%" stop-color="${accentColor}" stop-opacity="0.02"/>
          </linearGradient>
        </defs>
        <line x1="12" y1="${yBase}" x2="${w - 12}" y2="${yBase}" stroke="rgba(255,255,255,0.08)" stroke-width="1.2"/>
        <line x1="12" y1="${yMid}" x2="${w - 12}" y2="${yMid}" stroke="${accentColor}" stroke-opacity="0.4" stroke-dasharray="5,4" stroke-width="1.4"/>
        <polygon points="${tcpArea}" fill="url(#${gradTcp})"/>
        <polyline points="${tcpPoly}" fill="none" stroke="${accentColor}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
        <polyline points="${udpPoly}" fill="none" stroke="#94a3b8" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="5,4"/>
      </svg>
    `;
  }

  function renderWaveformChartSvg({ title, series = [], height = 200, suffix = '%', benchmarkVal = null }) {
    const n = Math.max(...series.map(s => s.data?.length || 0));
    const w = 800, h = height;
    if (n < 2) {
      return `
        <section class="card sensors-waveform-card">
          <div class="card-head"><h2>${escapeHtml(title)}</h2><span class="subtle">Collecting samples · ${n}/2</span></div>
          <div class="waveform-chart-box"><div class="chart-empty">Waveform appears after two live samples.</div></div>
        </section>
      `;
    }
    const allValues = series.flatMap(s => s.data || []).map(Number).filter(Number.isFinite);
    let maxV = Math.max(...allValues, 1);
    let minV = suffix === ' °C' ? Math.floor(Math.min(...allValues) - 2) : Math.min(0, ...allValues);
    if (suffix === '%' && maxV < 100) maxV = 100;
    if (maxV === minV) maxV = minV + 1;
    const range = maxV - minV;

    const formatTick = (val) => {
      if (suffix === ' B/s') return formatRate(val);
      if (suffix === ' bytes') return formatBytes(val);
      if (suffix === ' °C') return `${Math.round(val)}°C`;
      if (suffix === '%') return `${Math.round(val)}%`;
      if (suffix === ' W') return `${val >= 10 ? Math.round(val) : val.toFixed(1)}W`;
      return `${Math.round(val)}${suffix}`;
    };

    const isLongUnit = suffix === ' B/s' || suffix === ' bytes' || suffix === ' B';
    const tickRatios = [1.0, 0.75, 0.5, 0.25, 0.0];
    const tickItems = tickRatios.map(ratio => {
      const v = minV + ratio * range;
      const txt = formatTick(v);
      return { ratio, txt };
    });

    const maxChars = Math.max(...tickItems.map(t => t.txt.length), 4);
    const neededLeft = Math.ceil(maxChars * 6.6 + 16);
    const xLeft = isLongUnit ? Math.max(88, neededLeft) : Math.max(56, neededLeft);
    const xRight = w - 12;
    const yBase = h - 18;
    const yTop = 16;
    const graphH = yBase - yTop;
    const stepX = (xRight - xLeft) / (n - 1);

    const yAxisTicks = tickItems.map(({ ratio, txt }) => {
      const y = yBase - ratio * graphH;
      return `<text x="${xLeft - 8}" y="${(y + 3.5).toFixed(1)}" text-anchor="end" fill="#64748b" font-size="10" font-family="ui-monospace, monospace" font-weight="600">${txt}</text>`;
    }).join('');

    const legend = series.map((s, idx) => `
      <span class="chart-legend-item">
        <i style="background:${s.color || 'var(--accent)'}"></i>
        ${escapeHtml(s.label)}
      </span>
    `).join('');

    const gridLines = [0.25, 0.5, 0.75, 1.0].map(ratio => {
      const y = (yBase - ratio * graphH).toFixed(1);
      return `<line x1="${xLeft}" y1="${y}" x2="${xRight}" y2="${y}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="5,5" stroke-width="1"/>`;
    }).join('');

    const benchmarkLine = benchmarkVal != null
      ? `<line x1="${xLeft}" y1="${(yBase - Math.max(0.05, Math.min(0.95, (benchmarkVal - minV) / range)) * graphH).toFixed(1)}" x2="${xRight}" y2="${(yBase - Math.max(0.05, Math.min(0.95, (benchmarkVal - minV) / range)) * graphH).toFixed(1)}" stroke="var(--accent)" stroke-opacity="0.5" stroke-dasharray="6,4" stroke-width="1.4"/>`
      : '';

    const paths = series.map((s, idx) => {
      const d = s.data || [];
      const pts = d.map((v, i) => {
        const x = (xLeft + i * stepX).toFixed(1);
        const norm = Math.max(0.02, Math.min(0.98, ((Number(v) || 0) - minV) / range));
        const y = (yBase - norm * graphH).toFixed(1);
        return `${x},${y}`;
      });
      const poly = pts.join(' ');
      const area = `${xLeft},${yBase} ${poly} ${xLeft + (d.length - 1) * stepX},${yBase}`;
      const gradId = 'wf-grad-' + idx + '-' + Math.random().toString(36).slice(2, 6);
      return `
        <defs>
          <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${s.color || 'var(--accent)'}" stop-opacity="${s.fillOpacity ?? 0.32}"/>
            <stop offset="100%" stop-color="${s.color || 'var(--accent)'}" stop-opacity="0.01"/>
          </linearGradient>
        </defs>
        <polygon points="${area}" fill="url(#${gradId})"/>
        <polyline points="${poly}" fill="none" stroke="${s.color || 'var(--accent)'}" stroke-width="${s.strokeWidth || 2.5}" stroke-linecap="round" stroke-linejoin="round"/>
      `;
    }).join('');

    return `
      <section class="card sensors-waveform-card">
        <div class="card-head">
          <h2>${escapeHtml(title)}</h2>
          <div class="chart-legend">${legend}</div>
        </div>
        <div class="waveform-chart-box">
          <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${escapeHtml(title)}" preserveAspectRatio="none" style="width:100%;height:${h}px;display:block;overflow:visible;">
            <line x1="${xLeft}" y1="${yBase}" x2="${xRight}" y2="${yBase}" stroke="rgba(255,255,255,0.08)" stroke-width="1.2"/>
            ${yAxisTicks}
            ${gridLines}
            ${benchmarkLine}
            ${paths}
          </svg>
        </div>
        <div class="waveform-time-axis" style="padding-left: calc(6px + ${(xLeft / w * 100).toFixed(2)}%); padding-right: calc(6px + ${((w - xRight) / w * 100).toFixed(2)}%);">
          <span>60s ago</span>
          <span>45s</span>
          <span>30s</span>
          <span>15s</span>
          <span>Now</span>
        </div>
      </section>
    `;
  }

  function renderLivePowerWaveformSvg(data, currentWatts, height = 76) {
    const w = 400, h = height;
    const ptsCount = data.length || 1;
    const maxW = Math.max(25, ...data, currentWatts * 1.25);
    const minW = 0;
    const range = maxW - minW || 1;
    const yBase = h - 10;
    const yTop = 16;
    const graphH = yBase - yTop;
    const stepX = (w - 30) / Math.max(1, ptsCount - 1);

    const pts = data.map((v, i) => {
      const x = (15 + i * stepX).toFixed(1);
      const norm = Math.max(0.05, Math.min(0.95, (Number(v) - minW) / range));
      const y = (yBase - norm * graphH).toFixed(1);
      return { x: Number(x), y: Number(y) };
    });

    const poly = pts.map(p => `${p.x},${p.y}`).join(' ');
    const lastPt = pts.at(-1) || { x: w - 15, y: yBase - 0.5 * graphH };
    const area = `15,${yBase} ${poly} ${lastPt.x},${yBase}`;

    const gridLines = [0.33, 0.66].map(r => {
      const y = (yBase - r * graphH).toFixed(1);
      return `<line x1="15" y1="${y}" x2="${w - 15}" y2="${y}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="4,4" stroke-width="1"/>`;
    }).join('');

    const pillX = Math.min(w - 75, Math.max(65, lastPt.x - 45));
    const pillY = Math.max(14, lastPt.y - 14);

    return `
      <div class="power-waveform-box">
        <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Power Draw Waveform" preserveAspectRatio="none" style="width:100%;height:${h}px;display:block;">
          <defs>
            <linearGradient id="power-wf-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.35"/>
              <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.02"/>
            </linearGradient>
          </defs>
          ${gridLines}
          <line x1="15" y1="${yBase}" x2="${w - 15}" y2="${yBase}" stroke="rgba(255,255,255,0.08)" stroke-width="1.2"/>
          <polygon points="${area}" fill="url(#power-wf-grad)"/>
          <polyline points="${poly}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          <rect x="${pillX - 40}" y="${pillY - 10}" width="82" height="18" rx="9" fill="#0b1322" stroke="var(--accent)" stroke-width="1.2" stroke-opacity="0.6"/>
          <text x="${pillX + 1}" y="${pillY + 2.5}" text-anchor="middle" fill="#f1f5f9" font-size="9" font-family="ui-monospace, monospace" font-weight="700" letter-spacing="0.4px">${currentWatts.toFixed(1)} W LOAD</text>
          <circle cx="${lastPt.x}" cy="${lastPt.y}" r="6" fill="var(--accent)" fill-opacity="0.25"/>
          <circle cx="${lastPt.x}" cy="${lastPt.y}" r="3" fill="#ffffff" stroke="var(--accent)" stroke-width="1.5"/>
        </svg>
      </div>
    `;
  }

  async function pollSensors(force = false) {
    if (state.sensorBusy || state.tab !== 'sensors' || (!force && (document.hidden || state.sensorsCadence === 0))) return;
    state.sensorBusy = true;
    try {
      await loadData('sensors');
      if (state.tab === 'sensors' && !document.activeElement?.matches('#sensor-app-filter')) {
        renderSensors();
      }
    } finally {
      state.sensorBusy = false;
      if (state.tab === 'sensors' && state.sensorsCadence > 0 && !document.hidden) {
        clearTimeout(state.sensorTimer);
        state.sensorTimer = setTimeout(pollSensors, state.sensorsCadence);
      }
    }
  }

  function renderHardwareSensors() {
    if (!state.sensorInventoryLoaded) {
      content.innerHTML = `<section class="card">${state.sensorInventoryLoading ? 'Reading Android sensors…' : 'Loading Android sensors…'}</section>`;
      if (!state.sensorInventoryLoading && state.serial) {
        state.sensorInventoryLoading = true;
        const serial = state.serial;
        Promise.all([
          invokeOrFail('adb_data', { serial, section: 'sensor_inventory', path: null }),
          invokeOrFail('adb_data', { serial, section: 'sensor_readings', path: null })
        ]).then(([names, readings]) => {
          if (state.serial === serial) {
            state.sensorInventory = names;
            state.sensorReadings = readings;
            state.sensorSelected = names[0] || '';
            state.sensorInventoryLoaded = true;
          }
        }).catch((error) => {
          if (state.serial === serial) state.sensorInventoryLoaded = true;
          toast(String(error), true);
        }).finally(() => {
          state.sensorInventoryLoading = false;
          if (state.tab === 'hardware-sensors' && state.serial === serial) renderHardwareSensors();
        });
      }
      return;
    }
    const category = (name) => /fingerprint/i.test(name) ? 'Biometrics'
      : /(accelerometer|gyroscope|magnetometer|rotation|gravity|linear acceleration|step counter|step detector)/i.test(name) ? 'Motion & orientation'
      : /(ambient light|proximity|pressure|temperature|humidity)/i.test(name) ? 'Environment'
      : /(heart|health)/i.test(name) ? 'Health' : 'Other';
    const groups = new Map();
    for (const name of state.sensorInventory) {
      const kind = category(name);
      if (!groups.has(kind)) groups.set(kind, []);
      groups.get(kind).push(name);
    }
    const selected = state.sensorSelected || state.sensorInventory[0] || '';
    state.sensorSelected = selected;
    const reading = state.sensorReadings.find((item) => item.name.toLowerCase() === selected.toLowerCase());
    const labels = /accelerometer|gyroscope|magnetometer/i.test(selected) ? ['X', 'Y', 'Z', 'W'] : /light|als/i.test(selected) ? ['Illuminance', 'Value 2', 'Value 3'] : /proximity/i.test(selected) ? ['Distance', 'Value 2', 'Value 3'] : [];
    content.innerHTML = `<section class="card"><div class="card-head"><div><h2>Sensor readings</h2><span class="subtle">${state.sensorInventory.length} hardware sensors · latest Android events</span></div><button class="button" id="sensor-readings-refresh" ${state.sensorInventoryLoading ? 'disabled' : ''}>${icon('e145')} Refresh readings</button></div>${state.sensorInventory.length ? `<div class="sensor-inspector"><aside class="sensor-inspector-list" aria-label="Hardware sensors">${[...groups].map(([kind, names]) => `<div class="sensor-inspector-group"><span class="sensor-inspector-heading">${escapeHtml(kind)}</span>${names.map((name) => `<button class="sensor-inspector-item ${name === selected ? 'active' : ''}" data-sensor-select="${escapeHtml(name)}"><span class="icon">&#xe186;</span><span>${escapeHtml(name)}</span><i class="${state.sensorReadings.some((item) => item.name.toLowerCase() === name.toLowerCase()) ? 'has-reading' : ''}"></i></button>`).join('')}</div>`).join('')}</aside><section class="sensor-reading-panel"><div class="sensor-reading-title"><div><span class="eyebrow">SELECTED SENSOR</span><h3>${escapeHtml(selected)}</h3></div><span class="chip ${reading ? 'sensor-live-chip' : ''}">${reading ? 'EVENT AVAILABLE' : 'NO RECENT EVENT'}</span></div>${reading ? `<div class="sensor-reading-values">${reading.values.map((value, index) => `<article class="sensor-reading-value"><span>${escapeHtml(labels[index] || `Value ${index + 1}`)}</span><b>${Number(value).toFixed(3)}</b></article>`).join('')}</div><div class="sensor-reading-meta">Latest cached event · ${escapeHtml(reading.time || 'time unavailable')}</div>` : `<div class="sensor-reading-empty"><span class="icon">&#xe1ae;</span><b>No recent reading</b><span>Android only reports values after an app or system service activates this sensor.</span></div>`}</section></div>` : empty('No sensor inventory available', 'Android SensorService did not report hardware sensors.')}</section>`;
    $('#sensor-readings-refresh').onclick = async () => {
      const serial = state.serial;
      const button = $('#sensor-readings-refresh');
      button.disabled = true;
      try { state.sensorReadings = await invokeOrFail('adb_data', { serial, section: 'sensor_readings', path: null }); }
      catch (error) { toast(String(error), true); }
      finally { if (state.tab === 'hardware-sensors' && state.serial === serial) renderHardwareSensors(); }
    };
    content.querySelectorAll('[data-sensor-select]').forEach((button) => {
      button.onclick = () => { state.sensorSelected = button.dataset.sensorSelect; renderHardwareSensors(); };
    });
  }

  function renderSensors() {
    const s = state.data || {}, t = state.telemetry || {};
    const subtabs = [
      ['overview', 'Overview', 'e038'],
      ['top-apps', 'Top Apps', 'e129'],
      ['cpu', 'CPU', 'e0a9'],
      ['ram', 'RAM', 'e445'],
      ['gpu', 'GPU', 'e0df'],
      ['storage', 'Storage', 'e0c5'],
      ['wifi', 'Wi-Fi', 'e1ae'],
      ['cellular', 'Cellular', 'e142'],
      ['data-usage', 'Data Usage', 'e125'],
      ['power', 'Power', 'e055'],
      ['bluetooth', 'Bluetooth', 'e05c'],
      ['temperature', 'Temperature', 'e186']
    ];

    const kb = (value) => {
      if (value == null || !Number.isFinite(Number(value))) return 'Unavailable';
      return `${(Number(value) / 1024 / 1024).toFixed(2)} GB`;
    };
    const onOff = (value) => value == null ? 'Unavailable' : value ? 'On' : 'Off';
    const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const peak = (arr) => arr.length ? Math.max(...arr) : 0;

    const currentCpu = Number(s.cpu_usage_pct ?? state.sensorHistory.at(-1)?.cpu ?? 0);
    const memUsage = s.mem_total_kb && s.mem_available_kb != null ? (100 * (s.mem_total_kb - s.mem_available_kb) / s.mem_total_kb) : 0;
    const usedMemoryKb = s.mem_total_kb && s.mem_available_kb != null ? s.mem_total_kb - s.mem_available_kb : 0;
    const swapUsage = s.swap_total_kb ? (100 * (s.swap_total_kb - (s.swap_free_kb || 0)) / s.swap_total_kb) : 0;
    const usedSwapKb = s.swap_total_kb ? s.swap_total_kb - (s.swap_free_kb || 0) : 0;

    const totalStorageGb = s.storage_internal_total_kb == null ? (Number(t.storage_internal_total_gb) || 0) : Number(s.storage_internal_total_kb) / 1024 / 1024;
    const freeStorageGb = s.storage_internal_free_kb == null ? (Number(t.storage_internal_free_gb) || 0) : Number(s.storage_internal_free_kb) / 1024 / 1024;
    const usedStorageGb = Math.max(0, totalStorageGb - freeStorageGb);
    const storageUsage = totalStorageGb > 0 ? (100 * usedStorageGb / totalStorageGb) : 0;

    const network = s.network_interfaces || [];
    const temps = s.temperatures || [];
    const processes = s.top_processes || [];
    const sensors = state.sensorInventoryLoaded ? state.sensorInventory : (s.sensor_names || []);

    const hist = state.sensorHistory;
    const cpuHist = hist.map(h => Number(h.cpu) || 0);
    const ramHist = hist.map(h => Number(h.ram) || 0);
    const swapHist = hist.map(h => Number(h.swap) || 0);
    const storageHist = hist.map(h => Number(h.storage) || 0);
    const rxHist = hist.map(h => Number(h.rxRate) || 0);
    const txHist = hist.map(h => Number(h.txRate) || 0);
    const readHist = hist.map(h => Number(h.diskReadRate) || 0);
    const writeHist = hist.map(h => Number(h.diskWriteRate) || 0);
    const tcpHist = hist.map(h => Number(h.socketTcp) || 0);
    const udpHist = hist.map(h => Number(h.socketUdp) || 0);
    const battHist = hist.map(h => Number(h.battery) || 0);
    const tempHist = hist.map(h => Number(h.temp) || 0);

    const latest = hist.at(-1) || {};
    const currRxRate = Number(latest.rxRate) || 0;
    const currTxRate = Number(latest.txRate) || 0;
    const netPeakRate = Math.max(1024, ...rxHist, ...txHist);
    const totRx = network.reduce((acc, iface) => acc + (Number(iface.rx_bytes) || 0), 0);
    const totTx = network.reduce((acc, iface) => acc + (Number(iface.tx_bytes) || 0), 0);
    const usageType = state.dataUsageNetwork === 'mobile' ? 'mobile' : 'wifi';
    const usagePattern = usageType === 'wifi' ? /^(wlan|wifi)/i : /^(rmnet|ccmni|wwan|pdp)/i;
    const usageIfaces = network.filter((iface) => usagePattern.test(iface.name));
    const usageRx = usageIfaces.reduce((sum, iface) => sum + (Number(iface.rx_bytes) || 0), 0);
    const usageTx = usageIfaces.reduce((sum, iface) => sum + (Number(iface.tx_bytes) || 0), 0);
    const usageHistory = hist.map((sample) => ({ rx: Number(sample[`${usageType}Rx`]) || 0, tx: Number(sample[`${usageType}Tx`]) || 0, rxRate: Number(sample[`${usageType}RxRate`]) || 0, txRate: Number(sample[`${usageType}TxRate`]) || 0 }));
    const usageRxRate = Number(latest[`${usageType}RxRate`]) || 0, usageTxRate = Number(latest[`${usageType}TxRate`]) || 0;
    const avgRxRate = avg(rxHist);
    const avgTxRate = avg(txHist);

    const socketTotal = Number(latest.socketTotal || s.socket_total || 0);
    const socketTcp = Number(latest.socketTcp || s.socket_tcp || 0);
    const socketUdp = Number(latest.socketUdp || s.socket_udp || 0);

    const freqGhz = s.cpu_frequencies_mhz?.length ? (Math.max(...s.cpu_frequencies_mhz) / 1000).toFixed(2) : '2.00';
    const minFreqMhz = s.cpu_frequencies_mhz?.length ? (Math.min(...s.cpu_frequencies_mhz) / 1000).toFixed(2) : '1.00';
    const uptimeHours = s.uptime_secs ? Math.floor(s.uptime_secs / 3600) : 0;
    const uptimeMins = s.uptime_secs ? Math.floor((s.uptime_secs % 3600) / 60) : 0;

    // ══════════════════════════════════════════════════════════════════════════
    // WINDOWS TASK MANAGER: Authentic Two-Tier Header Process Grid
    // ══════════════════════════════════════════════════════════════════════════
    function isForegroundApp(nameLower) {
      if (
        nameLower.startsWith('[') || nameLower.startsWith('kworker') ||
        nameLower.startsWith('irq/') || nameLower.startsWith('ksoftirqd') ||
        nameLower.startsWith('rcu_') || nameLower.startsWith('migration') ||
