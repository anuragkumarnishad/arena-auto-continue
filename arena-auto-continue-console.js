(function () {
  'use strict';

  // Purani instance saaf karo
  if (window.__acCleanup) {
    try { window.__acCleanup(); } catch (e) {}
  }
  // Sirf main frame
  if (window.self !== window.top) return;

  /* ================= CONFIG ================= */
  const POSITIVE = [
    'continue', 'next', 'yes', 'yes, continue', 'proceed', 'keep going',
    'perfect, continue', 'ok, next', 'sounds good, go ahead', 'yes please',
    'sure, keep going', 'haan, aage badho', 'theek hai, continue karo',
    'badiya, next step karo', 'ok bhai, proceed', 'haan bilkul'
  ];
  const MAX_ACTIONS = 300;
  const MAX_HOURS = 10;

  const state = {
    running: false,
    timer: null,
    intervalSec: Math.max(5, Number(localStorage.getItem('arena-ac-interval')) || 45),
    msgMode: localStorage.getItem('arena-ac-msg') || 'random',
    kwSeen: false,
    captchaSeen: false,
    queue: '',
    photoFile: null,
    sendDraft: localStorage.getItem('arena-ac-draft') !== '0',
    stats: { sent: 0, kw: 0, captcha: 0, startedAt: 0, lastTick: 0 }
  };

  function pickMessage() {
    return state.msgMode === 'random'
      ? POSITIVE[Math.floor(Math.random() * POSITIVE.length)]
      : state.msgMode;
  }

  /* ================= STYLES ================= */
  const style = document.createElement('style');
  style.textContent = [
    '#ac-panel{position:fixed;top:14px;right:14px;z-index:2147483647;width:282px;',
    'background:rgba(10,15,30,.93);backdrop-filter:blur(12px);',
    'border:1px solid rgba(99,102,241,.35);border-radius:16px;',
    'box-shadow:0 12px 40px rgba(0,0,0,.55);color:#e2e8f0;',
    'font:12px/1.5 "Segoe UI",system-ui,sans-serif;overflow:hidden;}',
    '#ac-head{display:flex;align-items:center;gap:8px;padding:10px 12px;cursor:move;',
    'background:linear-gradient(90deg,rgba(99,102,241,.28),rgba(16,185,129,.18));}',
    '.ac-dot{width:8px;height:8px;border-radius:50%;background:#64748b;box-shadow:0 0 0 rgba(0,0,0,0);transition:all .3s;}',
    '.ac-dot.on{background:#22c55e;box-shadow:0 0 10px #22c55e;}',
    '.ac-ver{font-size:10px;background:rgba(99,102,241,.3);border-radius:999px;padding:1px 7px;}',
    '#ac-head .sp{flex:1;}',
    '.ac-ibtn{background:rgba(30,41,59,.9);color:#e2e8f0;border:1px solid rgba(99,102,241,.3);',
    'border-radius:7px;width:24px;height:24px;cursor:pointer;font-size:12px;}',
    '.ac-ibtn:hover{filter:brightness(1.3);}',
    '#ac-body{padding:10px 12px 12px;display:flex;flex-direction:column;gap:8px;}',
    '.ac-row{display:flex;align-items:center;gap:6px;}',
    '.ac-input{background:rgba(30,41,59,.9);border:1px solid rgba(99,102,241,.35);color:#fff;',
    'border-radius:8px;padding:4px 6px;font:inherit;}',
    '#ac-interval{width:52px;}',
    '#ac-msg{flex:1;}',
    '#ac-toggle{border:none;border-radius:10px;padding:9px;font-weight:700;font-size:13px;',
    'cursor:pointer;color:#052e16;background:linear-gradient(90deg,#22c55e,#10b981);transition:filter .2s;}',
    '#ac-toggle.stop{color:#fff;background:linear-gradient(90deg,#ef4444,#f97316);}',
    '#ac-toggle:hover{filter:brightness(1.1);}',
    '#ac-status{padding:6px 9px;border-radius:9px;background:rgba(148,163,184,.12);',
    'border-left:3px solid #64748b;min-height:30px;transition:border-color .3s;}',
    '#ac-status.ok{border-left-color:#22c55e;}',
    '#ac-status.wait{border-left-color:#f59e0b;}',
    '#ac-status.warn{border-left-color:#ef4444;}',
    '#ac-stats{display:flex;gap:5px;flex-wrap:wrap;}',
    '.ac-chip{background:rgba(148,163,184,.14);border-radius:999px;padding:2px 8px;font-size:11px;}',
    '#ac-queue{width:100%;resize:vertical;min-height:40px;}',
    '.ac-qbtn{flex:1;border:none;border-radius:9px;padding:7px;font-weight:700;cursor:pointer;',
    'color:#fff;background:linear-gradient(90deg,#6366f1,#8b5cf6);transition:filter .2s;}',
    '.ac-qbtn:hover{filter:brightness(1.15);}',
    '.ac-chk{display:flex;align-items:center;gap:4px;font-size:11px;opacity:.85;cursor:pointer;}'
  ].join('\n');
  document.head.appendChild(style);

  /* ================= UI ================= */
  let toggleBtnEl = null;

  function initPanel() {
    if (document.getElementById('ac-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'ac-panel';
    panel.innerHTML = [
      '<div id="ac-head">',
      '<span class="ac-dot" id="ac-dot"></span>',
      '<b>Auto-Continue</b><span class="ac-ver">v2.2</span>',
      '<span class="sp"></span>',
      '<button class="ac-ibtn" id="ac-report" title="Report copy karo">📋</button>',
      '<button class="ac-ibtn" id="ac-min" title="Minimize">–</button>',
      '</div>',
      '<div id="ac-body">',
      '<div class="ac-row">Har <input class="ac-input" id="ac-interval" type="number" min="5" value="' +
        state.intervalSec + '"> sec ·',
      '<select class="ac-input" id="ac-msg">',
      '<option value="continue">continue</option>',
      '<option value="next">next</option>',
      '<option value="yes">yes</option>',
      '<option value="random">🎲 random positive</option>',
      '</select></div>',
      '<textarea class="ac-input" id="ac-queue" rows="2"',
      ' placeholder="📨 Apna message queue karo — AI ka current kaam khatam hote hi chala jayega..."></textarea>',
      '<div class="ac-row"><button class="ac-qbtn" id="ac-qbtn">📨 Queue karo</button>',
      '<button class="ac-ibtn" id="ac-photo" title="Photo queue karo" style="width:32px;height:32px;font-size:15px;">📷</button>',
      '<label class="ac-chk"><input type="checkbox" id="ac-draft"' +
        (state.sendDraft ? ' checked' : '') + '> draft auto</label></div>',
      '<button id="ac-toggle">▶ Start</button>',
      '<div id="ac-status">Ready — Start dabao 🚀</div>',
      '<div id="ac-stats"></div>',
      '</div>'
    ].join('\n');
    document.body.appendChild(panel);

    toggleBtnEl = panel.querySelector('#ac-toggle');
    const msgSelect = panel.querySelector('#ac-msg');
    const intervalInput = panel.querySelector('#ac-interval');
    msgSelect.value = state.msgMode;

    panel.querySelector('#ac-min').addEventListener('click', function () {
      const body = panel.querySelector('#ac-body');
      const hidden = body.style.display === 'none';
      body.style.display = hidden ? 'flex' : 'none';
      this.textContent = hidden ? '–' : '+';
    });

    panel.querySelector('#ac-report').addEventListener('click', copyReport);

    panel.querySelector('#ac-qbtn').addEventListener('click', function () {
      const ta = panel.querySelector('#ac-queue');
      state.queue = ta.value.trim();
      if (!state.queue) {
        setStatus('Queue khali hai — pehle message likho!', 'warn');
        return;
      }
      ta.value = '';
      setStatus('📨 Queue set: "' + state.queue.slice(0, 30) + '" — AI free hote hi jayega', 'ok');
    });

    panel.querySelector('#ac-draft').addEventListener('change', function () {
      state.sendDraft = this.checked;
      localStorage.setItem('arena-ac-draft', this.checked ? '1' : '0');
    });

    // Photo queue: file choose karo, agle message ke saath attach hogi
    const fileSel = document.createElement('input');
    fileSel.type = 'file';
    fileSel.accept = 'image/*';
    fileSel.style.display = 'none';
    panel.appendChild(fileSel);
    panel.querySelector('#ac-photo').addEventListener('click', function () {
      fileSel.click();
    });
    fileSel.addEventListener('change', function () {
      if (fileSel.files && fileSel.files[0]) {
        state.photoFile = fileSel.files[0];
        setStatus('📷 Photo ready: ' + state.photoFile.name + ' — agle message ke saath jayegi', 'ok');
      }
    });

    intervalInput.addEventListener('change', function () {
      state.intervalSec = Math.max(5, Number(this.value) || 45);
      this.value = state.intervalSec;
      localStorage.setItem('arena-ac-interval', String(state.intervalSec));
      if (state.running) {
        clearTimeout(state.timer);
        scheduleNext();
      }
    });

    msgSelect.addEventListener('change', function () {
      state.msgMode = this.value;
      localStorage.setItem('arena-ac-msg', state.msgMode);
    });

    toggleBtnEl.addEventListener('click', function () {
      state.running = !state.running;
      const dot = panel.querySelector('#ac-dot');
      if (state.running) {
        toggleBtnEl.textContent = '⏸ Stop';
        toggleBtnEl.classList.add('stop');
        dot.classList.add('on');
        if (!state.stats.startedAt) state.stats.startedAt = Date.now();
        setStatus('Running… ', 'ok');
        updateStats();
        startKeepAlive();
        startWsKeepAlive();
        tick();
        scheduleNext();
      } else {
        toggleBtnEl.textContent = '▶ Start';
        toggleBtnEl.classList.remove('stop');
        dot.classList.remove('on');
        clearTimeout(state.timer);
        stopKeepAlive();
        stopWsKeepAlive();
        setStatus('Stopped', 'warn');
      }
    });

    // Draggable
    panel.querySelector('#ac-head').addEventListener('mousedown', function (e) {
      if (e.target.tagName === 'BUTTON') return;
      e.preventDefault();
      const sx = e.clientX, sy = e.clientY;
      const r = panel.getBoundingClientRect();
      function mv(ev) {
        panel.style.left = r.left + ev.clientX - sx + 'px';
        panel.style.top = r.top + ev.clientY - sy + 'px';
        panel.style.right = 'auto';
      }
      function up() {
        document.removeEventListener('mousemove', mv);
        document.removeEventListener('mouseup', up);
      }
      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup', up);
    });
  }

  function setStatus(msg, kind) {
    const el = document.getElementById('ac-status');
    if (!el) return;
    el.textContent = msg;
    el.className = kind || '';
  }

  function updateStats() {
    const el = document.getElementById('ac-stats');
    if (!el) return;
    const s = state.stats;
    const mins = s.startedAt ? Math.floor((Date.now() - s.startedAt) / 60000) : 0;
    function chip(t) { return '<span class="ac-chip">' + t + '</span>'; }
    el.innerHTML =
      chip('✅ ' + s.sent) + chip('🔁 ' + s.kw) + chip('🚨 ' + s.captcha) +
      chip('⏱ ' + mins + 'm') +
      (s.lastTick ? chip('🕐 ' + new Date(s.lastTick).toLocaleTimeString()) : '');
  }

  function copyReport() {
    const s = state.stats;
    const mins = s.startedAt ? Math.floor((Date.now() - s.startedAt) / 60000) : 0;
    const rep =
      '⚡ Auto-Continue v2.0 Report\n⏱ Chala: ' + mins + ' min\n✅ Messages: ' +
      s.sent + '\n🔁 Keep working: ' + s.kw + '\n🚨 CAPTCHA: ' + s.captcha;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(rep).then(function () {
        setStatus('📋 Report copy ho gaya!', 'ok');
      }, function () { setStatus(rep, 'ok'); });
    } else {
      setStatus(rep, 'ok');
    }
  }

  /* ================= KEEP-ALIVE ================= */
  let keepAliveAudio = null;
  function startKeepAlive() {
    if (keepAliveAudio) return;
    try {
      const a = new Audio(
        'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAAAA'
      );
      a.loop = true;
      a.volume = 0.01;
      a.play().catch(function () {});
      keepAliveAudio = a;
    } catch (e) {}
  }
  function stopKeepAlive() {
    if (keepAliveAudio) {
      try { keepAliveAudio.pause(); } catch (e) {}
      keepAliveAudio = null;
    }
  }

  let keepAliveWs = null;
  let wsRetry = null;
  function startWsKeepAlive() {
    if (keepAliveWs && keepAliveWs.readyState <= 1) return;
    try {
      keepAliveWs = new WebSocket('wss://ws.postman-echo.com/raw');
      keepAliveWs.onclose = scheduleWsRetry;
      keepAliveWs.onerror = function () {
        try { keepAliveWs.close(); } catch (e) {}
      };
    } catch (e) { scheduleWsRetry(); }
  }
  function scheduleWsRetry() {
    if (!state.running) return;
    clearTimeout(wsRetry);
    wsRetry = setTimeout(startWsKeepAlive, 60000);
  }
  function stopWsKeepAlive() {
    clearTimeout(wsRetry);
    if (keepAliveWs) {
      try { keepAliveWs.close(); } catch (e) {}
      keepAliveWs = null;
    }
  }

  /* ================= SCHEDULER ================= */
  function scheduleNext() {
    // Human jaisa: interval ka 1x-2x random + kabhi chai break
    let wait = state.intervalSec + Math.floor(Math.random() * state.intervalSec);
    if (Math.random() < 0.12) {
      wait += 120 + Math.floor(Math.random() * 180);
      setStatus('☕ Chai break — 2-4 min ruka hoon', 'wait');
    }
    state.timer = setTimeout(function () {
      tick();
      if (state.running) scheduleNext();
    }, wait * 1000);
  }

  window.__acCleanup = function () {
    state.running = false;
    clearTimeout(state.timer);
    stopKeepAlive();
    stopWsKeepAlive();
    const p = document.getElementById('ac-panel');
    if (p) p.remove();
    const st = document.getElementById('ac-style');
    if (st) st.remove();
  };

  /* ================= DOM HELPERS ================= */
  function isVisible(el) {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    const cs = window.getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05;
  }

  function findInput() {
    const selectors = ['textarea', 'div[contenteditable="true"]', '[role="textbox"]'];
    const candidates = [];
    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 50 && rect.height > 10 && rect.bottom > 0 && rect.top < window.innerHeight) {
          candidates.push({ el: el, top: rect.top });
        }
      }
    }
    if (!candidates.length) return null;
    candidates.sort(function (a, b) { return b.top - a.top; });
    return candidates[0].el;
  }

  function findKeepWorking() {
    const els = document.querySelectorAll('button, [role="button"]');
    for (const el of els) {
      if (/keep\s*working/i.test(el.textContent || '') && isVisible(el)) return el;
    }
    return null;
  }

  function findYesButton() {
    const els = document.querySelectorAll('button, [role="button"]');
    for (const el of els) {
      const t = (el.textContent || '').trim();
      if (/^yes$/i.test(t) && isVisible(el)) return el;
    }
    return null;
  }

  function hasStopButton() {
    for (const btn of document.querySelectorAll('button')) {
      const label = ((btn.getAttribute('aria-label') || '') + ' ' + (btn.title || '')).toLowerCase();
      if (/stop|abort/.test(label) && isVisible(btn)) return true;
    }
    return false;
  }

  function findSendButton(inputEl) {
    const form = inputEl.closest && inputEl.closest('form');
    const container = inputEl.closest &&
      inputEl.closest('[class*="composer"], [class*="chat"], [class*="prompt"]');
    const scopes = [];
    if (form) scopes.push(form);
    if (container && container !== form) scopes.push(container);
    scopes.push(document);

    function score(btn, inForm) {
      if (btn.disabled || !isVisible(btn)) return -1;
      const label = (
        (btn.getAttribute('aria-label') || '') + ' ' + (btn.title || '') + ' ' +
        btn.textContent + ' ' + (btn.getAttribute('data-testid') || '')
      ).toLowerCase();
      let s = 0;
      if (/send|bhejo/.test(label)) s += 6;
      if (btn.type === 'submit') s += 4;
      if (btn.querySelector('svg')) s += 1;
      if (inForm) s += 1;
      return s;
    }

    for (let i = 0; i < scopes.length; i++) {
      const scope = scopes[i];
      const inForm = scope === form;
      let best = null, bestScore = 0;
      scope.querySelectorAll('button').forEach(function (btn) {
        const s = score(btn, inForm);
        if (s > bestScore) { best = btn; bestScore = s; }
      });
      if (best && bestScore >= (scope === document ? 6 : 4)) return best;
    }
    if (form) {
      for (const btn of form.querySelectorAll('button')) {
        if (!btn.disabled && isVisible(btn)) return btn;
      }
    }
    return null;
  }

  function inputText(el) {
    return el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' ? el.value : el.textContent;
  }

  function setInputText(el, text) {
    el.focus();
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      if (el.select) el.select();
    } else if (el.isContentEditable) {
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
    let ok = false;
    try { ok = document.execCommand('insertText', false, text); } catch (e) { ok = false; }
    if (!ok) {
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
        const proto = el.tagName === 'TEXTAREA'
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, text);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (el.isContentEditable) {
        el.textContent = text;
        el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
      }
    }
  }

  function pressEnter(el) {
    ['keydown', 'keypress', 'keyup'].forEach(function (type) {
      el.dispatchEvent(new KeyboardEvent(type, {
        key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
        bubbles: true, cancelable: true
      }));
    });
  }

  /* ================= CAPTCHA ================= */
  function captchaPresent() {
    const sel =
      'iframe[src*="captcha" i], iframe[src*="turnstile" i], iframe[src*="hcaptcha" i], iframe[src*="recaptcha" i], [class*="captcha" i], [id*="captcha" i], [class*="turnstile" i]';
    const els = document.querySelectorAll(sel);
    for (const el of els) if (isVisible(el)) return true;
    const t = (document.body && document.body.innerText) || '';
    return /verify you are (a )?human|prove you.?re (a )?human|are you a robot|complete the (captcha )?check/i.test(
      t.slice(0, 3000)
    );
  }

  /* ================= PHOTO ATTACH ================= */
  function findFileInput() {
    let fi = document.querySelector('input[type="file"][accept*="image" i]') ||
      document.querySelector('input[type="file"]');
    if (!fi) {
      // Attach button click karke hidden input lao
      const btns = document.querySelectorAll('button');
      for (const b of btns) {
        const l = ((b.getAttribute('aria-label') || '') + ' ' + (b.title || '')).toLowerCase();
        if (/attach|upload|add file|image/.test(l) && isVisible(b)) {
          b.click();
          break;
        }
      }
      fi = document.querySelector('input[type="file"]');
    }
    return fi;
  }

  function attachPhoto(done) {
    const fi = findFileInput();
    if (!fi || !state.photoFile) {
      done(false);
      return;
    }
    try {
      const dt = new DataTransfer();
      dt.items.add(state.photoFile);
      fi.files = dt.files;
      fi.dispatchEvent(new Event('change', { bubbles: true }));
      setTimeout(function () { done(true); }, 1500); // upload preview ke liye wait
    } catch (e) {
      done(false);
    }
  }

  /* ================= SENDING ================= */
  function attemptSend(input, msg) {
    const btn = findSendButton(input);
    if (btn && !btn.disabled) {
      btn.click();
      verifySent(input, msg, 'Send button');
      return;
    }
    const form = input.closest && input.closest('form');
    if (form && form.requestSubmit) {
      try {
        form.requestSubmit();
        verifySent(input, msg, 'Form submit');
        return;
      } catch (e) {}
    }
    pressEnter(input);
    verifySent(input, msg, 'Enter key');
  }

  function verifySent(input, msg, how) {
    setTimeout(function () {
      const gone = !input.isConnected || inputText(input).trim() === '';
      if (gone) {
        state.stats.sent++;
        updateStats();
        setStatus('✅ "' + msg + '" sent (' + how + ')', 'ok');
        return;
      }
      pressEnter(input);
      setTimeout(function () {
        if (!input.isConnected || inputText(input).trim() === '') {
          state.stats.sent++;
          updateStats();
          setStatus('✅ "' + msg + '" sent (Enter 2nd try)', 'ok');
        } else {
          setStatus('⚠️ Text type hua par SEND nahi hua', 'warn');
        }
      }, 700);
    }, 700);
  }

  /* ================= MAIN LOOP ================= */
  function tick() {
    if (!state.running) return;
    state.stats.lastTick = Date.now();
    updateStats();
    try {
      const s = state.stats;
      const total = s.sent + s.kw;

      // Safety brake
      if (s.startedAt && (total >= MAX_ACTIONS || Date.now() - s.startedAt > MAX_HOURS * 3600000)) {
        state.running = false;
        clearTimeout(state.timer);
        stopKeepAlive();
        stopWsKeepAlive();
        if (toggleBtnEl) {
          toggleBtnEl.textContent = '▶ Start';
          toggleBtnEl.classList.remove('stop');
        }
        setStatus('🏁 Safety limit poori (' + total + ' actions) — khud ruka.', 'warn');
        return;
      }

      // CAPTCHA guard
      if (captchaPresent()) {
        if (!state.captchaSeen) { s.captcha++; updateStats(); }
        state.captchaSeen = true;
        setStatus('🚨 CAPTCHA! Solve karo — script paused.', 'warn');
        return;
      }
      state.captchaSeen = false;

      // Feedback widget ("Was this task successful?") khula hai?
      const haveQueue = state.queue.trim() !== '';
      const kw = findKeepWorking();
      if (kw) {
        if (haveQueue || state.sendDraft) {
          // Queue/draft bhejna hai → pehle Yes se widget band karo, composer wapas aayega
          const yes = findYesButton();
          if (yes) {
            yes.click();
            setStatus('✅ "Yes" dabaya — ab queue/draft message bhejega', 'ok');
          } else {
            setStatus('Widget khula hai, Yes nahi mila… wait', 'wait');
          }
          return;
        }
        if (!state.kwSeen) {
          state.kwSeen = true;
          setStatus('📖 Reply padh raha hoon…', 'wait');
          return;
        }
        state.kwSeen = false;
        kw.click();
        s.kw++;
        updateStats();
        setStatus('✅ "Keep working" dabaya', 'ok');
        return;
      }
      state.kwSeen = false;

      if (hasStopButton()) {
        setStatus(
          haveQueue ? 'AI busy — free hote hi QUEUE message jayega ⏳' : 'AI reply likh rahi hai… wait ⏳',
          'wait'
        );
        return;
      }

      const input = findInput();
      if (!input) { setStatus('Input box nahi mila 😕', 'warn'); return; }
      if (input.disabled || input.readOnly) { setStatus('Input disabled — AI busy ⏳', 'wait'); return; }
      const existing = inputText(input).trim();

      // Queue message / composer draft / photo bhejo
      let msg = null;
      let fromQueue = false;
      if (haveQueue) {
        msg = state.queue;
        fromQueue = true;
      } else if (state.sendDraft && existing !== '') {
        msg = existing;
      }
      if (msg || state.photoFile) {
        const hasPhoto = !!state.photoFile;
        const sentMsg = msg || (hasPhoto ? 'ye photo dekho, iske hisaab se kaam karo' : '');
        const fire = function () {
          if (fromQueue || !msg) setInputText(input, sentMsg);
          setTimeout(function () { attemptSend(input, sentMsg); }, 300);
        };
        if (fromQueue) state.queue = '';
        setStatus(
          (hasPhoto ? '📷 ' : '') + (fromQueue ? '📨 Queue' : '✍️ Draft') +
          ' message bheja: "' + sentMsg.slice(0, 25) + '"', 'ok'
        );
        if (hasPhoto) {
          attachPhoto(function (ok) {
            state.photoFile = null;
            if (!ok) setStatus('⚠️ Photo attach nahi hui, message phir bhi jayega', 'warn');
            fire();
          });
        } else {
          fire();
        }
        return;
      }

      if (existing !== '') {
        setStatus('✋ Input me text hai (draft auto OFF) — skip', 'warn');
        return;
      }

      const rnd = pickMessage();
      setInputText(input, rnd);
      setTimeout(function () { attemptSend(input, rnd); }, 400);
    } catch (err) {
      setStatus('⚠️ Error: ' + err.message, 'warn');
    }
  }

  /* ================= BOOT ================= */
  if (document.body) initPanel();
  else document.addEventListener('DOMContentLoaded', initPanel);
})();
