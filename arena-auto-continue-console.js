(function () {
  'use strict';

  // Purani v1.2+ instance ho toh use saaf karo
  if (window.__acCleanup) {
    try {
      window.__acCleanup();
    } catch (e) {}
  }

  // Sirf main frame me chalo (iframe duplication se bachne ke liye)
  if (window.self !== window.top) return;

  // ================= SETTINGS =================
  const POSITIVE = [
    'continue',
    'next',
    'yes',
    'yes, continue',
    'proceed',
    'keep going',
    'perfect, continue',
    'ok, next',
    'sounds good, go ahead',
    'yes please',
    'sure, keep going',
    'haan, aage badho',
    'theek hai, continue karo',
    'badiya, next step karo',
    'ok bhai, proceed',
    'haan bilkul'
  ];
  const MAX_ACTIONS = 300; // itne actions ke baad script khud ruk jayegi (safety)
  const MAX_HOURS = 10; // ya itne ghanton ke baad

  let intervalSec = Math.max(5, Number(localStorage.getItem('arena-ac-interval') || 30));
  let msgMode = localStorage.getItem('arena-ac-msg') || 'continue';
  let running = false;
  let timer = null;
  let toggleBtnEl = null;
  let captchaFlag = false;
  let kwSeen = false;
  const stats = { sent: 0, kw: 0, captcha: 0, startedAt: 0 };

  function pickMessage() {
    return msgMode === 'random'
      ? POSITIVE[Math.floor(Math.random() * POSITIVE.length)]
      : msgMode;
  }

  // ================= TAB KEEP-ALIVE =================
  // Halka sa silent audio: background tab ko browser sone nahi deta
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
      try {
        keepAliveAudio.pause();
      } catch (e) {}
      keepAliveAudio = null;
    }
  }

  // WebSocket keep-alive: active connection = browser tab ko sone nahi deta
  let keepAliveWs = null;
  let wsRetry = null;
  function startWsKeepAlive() {
    if (keepAliveWs && keepAliveWs.readyState <= 1) return;
    try {
      keepAliveWs = new WebSocket('wss://ws.postman-echo.com/raw');
      keepAliveWs.onclose = scheduleWsRetry;
      keepAliveWs.onerror = function () {
        try {
          keepAliveWs.close();
        } catch (e) {}
      };
    } catch (e) {
      scheduleWsRetry();
    }
  }
  function scheduleWsRetry() {
    if (!running) return;
    clearTimeout(wsRetry);
    wsRetry = setTimeout(startWsKeepAlive, 60000);
  }
  function stopWsKeepAlive() {
    clearTimeout(wsRetry);
    if (keepAliveWs) {
      try {
        keepAliveWs.close();
      } catch (e) {}
      keepAliveWs = null;
    }
  }

  // ================= UI PANEL =================
  function initPanel() {
    if (document.getElementById('ac-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'ac-panel';
    panel.style.cssText =
      'position:fixed;top:12px;right:12px;z-index:2147483647;' +
      'background:#0f172a;color:#f8fafc;font:12px/1.5 system-ui,"Segoe UI",sans-serif;' +
      'padding:12px;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.4);' +
      'display:flex;flex-direction:column;gap:8px;width:270px;';

    panel.innerHTML = [
      '<div id="ac-head" style="display:flex;justify-content:space-between;align-items:center;cursor:move;">',
      '<span style="font-weight:700;font-size:13px;">⚡ Auto-Continue v1.13</span>',
      '<span style="display:flex;gap:4px;">',
      '<button id="ac-report" title="Report copy karo" style="background:#1e293b;color:#fff;border:none;border-radius:6px;width:22px;height:22px;cursor:pointer;">📋</button>',
      '<button id="ac-min" title="Minimize" style="background:#1e293b;color:#fff;border:none;border-radius:6px;width:22px;height:22px;cursor:pointer;">–</button>',
      '</span>',
      '</div>',
      '<div id="ac-body" style="display:flex;flex-direction:column;gap:8px;">',
      '<label style="display:flex;align-items:center;gap:6px;">Har',
      '<input id="ac-interval" type="number" min="5" value="' + intervalSec + '"',
      ' style="width:56px;background:#1e293b;color:#fff;border:1px solid #334155;border-radius:6px;padding:3px 6px;">',
      'sec mein</label>',
      '<label style="display:flex;align-items:center;gap:6px;">Message',
      '<select id="ac-msg"',
      ' style="flex:1;background:#1e293b;color:#fff;border:1px solid #334155;border-radius:6px;padding:3px 6px;">',
      '<option value="continue">continue</option>',
      '<option value="next">next</option>',
      '<option value="yes">yes</option>',
      '<option value="random">🎲 random positive</option>',
      '</select></label>',
      '<button id="ac-toggle"',
      ' style="background:#22c55e;color:#052e16;font-weight:700;border:none;border-radius:8px;padding:8px;cursor:pointer;">▶ Start</button>',
      '<div id="ac-status" style="opacity:.85;min-height:28px;">Ready</div>',
      '<div id="ac-stats" style="opacity:.7;"></div>',
      '</div>'
    ].join('\n');
    document.body.appendChild(panel);

    toggleBtnEl = panel.querySelector('#ac-toggle');
    const statusEl = panel.querySelector('#ac-status');
    const intervalInput = panel.querySelector('#ac-interval');
    const msgSelect = panel.querySelector('#ac-msg');
    const minBtn = panel.querySelector('#ac-min');
    const body = panel.querySelector('#ac-body');
    msgSelect.value = msgMode;

    window.__acStatus = function (msg) {
      statusEl.textContent = msg;
    };

    minBtn.addEventListener('click', function () {
      const hidden = body.style.display === 'none';
      body.style.display = hidden ? 'flex' : 'none';
      minBtn.textContent = hidden ? '–' : '+';
    });

    // Report button: pura hisaab clipboard pe
    const reportBtn = panel.querySelector('#ac-report');
    reportBtn.addEventListener('click', function () {
      const mins = stats.startedAt
        ? Math.floor((Date.now() - stats.startedAt) / 60000)
        : 0;
      const rep =
        '⚡ Auto-Continue Report\n⏱ Chala: ' + mins + ' min\n✅ Messages: ' +
        stats.sent + '\n🔁 Keep working: ' + stats.kw + '\n🚨 CAPTCHA: ' + stats.captcha;
      const done = function () {
        setStatus('📋 Report copy ho gaya! Kahin bhi paste karo.');
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(rep).then(done, function () {
          setStatus(rep);
        });
      } else {
        setStatus(rep);
      }
    });

    // Draggable panel: header pakad ke kahin bhi le jao
    const head = panel.querySelector('#ac-head');
    head.addEventListener('mousedown', function (e) {
      if (e.target.tagName === 'BUTTON') return;
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const rect = panel.getBoundingClientRect();
      function move(ev) {
        panel.style.left = rect.left + ev.clientX - startX + 'px';
        panel.style.top = rect.top + ev.clientY - startY + 'px';
        panel.style.right = 'auto';
      }
      function up() {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
      }
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });

    intervalInput.addEventListener('change', function () {
      intervalSec = Math.max(5, Number(intervalInput.value) || 30);
      intervalInput.value = intervalSec;
      localStorage.setItem('arena-ac-interval', String(intervalSec));
      if (running) {
        clearTimeout(timer);
        scheduleNext();
      }
    });

    msgSelect.addEventListener('change', function () {
      msgMode = msgSelect.value;
      localStorage.setItem('arena-ac-msg', msgMode);
    });

    toggleBtnEl.addEventListener('click', function () {
      running = !running;
      if (running) {
        toggleBtnEl.textContent = '⏸ Stop';
        toggleBtnEl.style.background = '#ef4444';
        toggleBtnEl.style.color = '#fff';
        if (!stats.startedAt) stats.startedAt = Date.now();
        window.__acStatus('Running…');
        updateStats();
        startKeepAlive();
        startWsKeepAlive();
        tick(); // turant ek baar try karo (test)
        scheduleNext();
      } else {
        toggleBtnEl.textContent = '▶ Start';
        toggleBtnEl.style.background = '#22c55e';
        toggleBtnEl.style.color = '#052e16';
        clearTimeout(timer);
        stopKeepAlive();
        stopWsKeepAlive();
        window.__acStatus('Stopped');
      }
    });
  }

  function updateStats() {
    const el = document.getElementById('ac-stats');
    if (!el) return;
    const mins = stats.startedAt
      ? Math.floor((Date.now() - stats.startedAt) / 60000)
      : 0;
    el.textContent =
      '📊 Msg: ' + stats.sent + ' | KW: ' + stats.kw + ' | 🚨 ' + stats.captcha +
      ' | ⏱ ' + mins + ' min' +
      (stats.lastTick ? ' | 🕐 ' + new Date(stats.lastTick).toLocaleTimeString() : '');
  }

  // Agla tick: human-jaisa random gap + kabhi-kabhi chai break
  function scheduleNext() {
    // interval ka 1x se 2x tak random wait
    let wait = intervalSec + Math.floor(Math.random() * intervalSec);
    // 12% chance: lamba break (2-5 min extra) — insaan break leta hai
    if (Math.random() < 0.12) {
      wait += 120 + Math.floor(Math.random() * 180);
      setStatus('☕ Chai break — 2-4 min ke liye ruka hoon');
    }
    timer = setTimeout(function () {
      tick();
      if (running) scheduleNext();
    }, wait * 1000);
  }

  // Agle paste ke liye cleanup handle
  window.__acCleanup = function () {
    running = false;
    if (timer) clearTimeout(timer);
    stopKeepAlive();
    stopWsKeepAlive();
    const p = document.getElementById('ac-panel');
    if (p) p.remove();
    delete window.__acStatus;
  };

  // Panel hamesha banao — page ke state pe depend nahi karta
  if (document.body) {
    initPanel();
  } else {
    document.addEventListener('DOMContentLoaded', initPanel);
  }

  function setStatus(msg) {
    if (window.__acStatus) window.__acStatus(msg);
  }
  function now() {
    return new Date().toLocaleTimeString();
  }

  // ================= CAPTCHA DETECT =================
  // Sirf TAB detect karo jab CAPTCHA asli me DIKH raha ho (hidden iframes pe nahi)
  function captchaPresent() {
    const sel =
      'iframe[src*="captcha" i], iframe[src*="turnstile" i], iframe[src*="hcaptcha" i], iframe[src*="recaptcha" i], [class*="captcha" i], [id*="captcha" i], [class*="turnstile" i]';
    const els = document.querySelectorAll(sel);
    for (const el of els) {
      if (isVisible(el)) return true;
    }
    // Sirf pakke human-check phrases (job-content se false alarm na ho)
    const t = (document.body && document.body.innerText) || '';
    return /verify you are (a )?human|prove you.?re (a )?human|are you a robot|complete the (captcha )?check/i.test(
      t.slice(0, 3000)
    );
  }

  // ================= CHAT HELPERS =================
  function findInput() {
    const selectors = ['textarea', 'div[contenteditable="true"]', '[role="textbox"]'];
    const candidates = [];
    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 50 && rect.height > 10) {
          // sirf viewport ke andar wale elements
          if (rect.bottom > 0 && rect.top < window.innerHeight) {
            candidates.push({ el: el, top: rect.top });
          }
        }
      }
    }
    if (!candidates.length) return null;
    // sabse neeche wala = asli chat composer
    candidates.sort(function (a, b) {
      return b.top - a.top;
    });
    return candidates[0].el;
  }

  function isVisible(el) {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    const cs = window.getComputedStyle(el);
    return (
      cs.visibility !== 'hidden' &&
      cs.display !== 'none' &&
      Number(cs.opacity) > 0.05
    );
  }

  function findKeepWorking() {
    const els = document.querySelectorAll('button, [role="button"]');
    for (const el of els) {
      if (/keep\s*working/i.test(el.textContent || '')) {
        if (isVisible(el)) return el;
      }
    }
    return null;
  }

  function hasStopButton() {
    for (const btn of document.querySelectorAll('button')) {
      const label = (
        (btn.getAttribute('aria-label') || '') + ' ' +
        (btn.title || '')
      ).toLowerCase();
      if (/stop|abort/.test(label)) {
        if (isVisible(btn)) return true;
      }
    }
    return false;
  }

  function findSendButton(inputEl) {
    const form = inputEl.closest && inputEl.closest('form');
    const container =
      inputEl.closest &&
      inputEl.closest('[class*="composer"], [class*="chat"], [class*="prompt"]');
    const scopes = [];
    if (form) scopes.push(form);
    if (container && container !== form) scopes.push(container);
    scopes.push(document);

    function score(btn, inForm) {
      if (btn.disabled) return -1;
      const r = btn.getBoundingClientRect();
      if (r.width < 5 || r.height < 5) return -1;
      const label = (
        (btn.getAttribute('aria-label') || '') + ' ' +
        (btn.title || '') + ' ' +
        btn.textContent + ' ' +
        (btn.getAttribute('data-testid') || '')
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
      let best = null;
      let bestScore = 0;
      scope.querySelectorAll('button').forEach(function (btn) {
        const s = score(btn, inForm);
        if (s > bestScore) {
          best = btn;
          bestScore = s;
        }
      });
      const need = scope === document ? 6 : 4; // pure page pe sirf pakka send button
      if (best && bestScore >= need) return best;
    }

    // Last fallback: form ka koi bhi enabled button
    if (form) {
      for (const btn of form.querySelectorAll('button')) {
        if (!btn.disabled) {
          const r = btn.getBoundingClientRect();
          if (r.width > 5 && r.height > 5) return btn;
        }
      }
    }
    return null;
  }

  function inputText(el) {
    return el.tagName === 'TEXTAREA' || el.tagName === 'INPUT'
      ? el.value
      : el.textContent;
  }

  function setInputText(el, text) {
    el.focus();
    // pehle existing content select karo taaki replace ho
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      if (el.select) el.select();
    } else if (el.isContentEditable) {
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
    // insertText: contenteditable/React editors ke liye sabse reliable
    let ok = false;
    try {
      ok = document.execCommand('insertText', false, text);
    } catch (e) {
      ok = false;
    }
    if (!ok) {
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
        const proto =
          el.tagName === 'TEXTAREA'
            ? window.HTMLTextAreaElement.prototype
            : window.HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, text);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (el.isContentEditable) {
        el.textContent = text;
        el.dispatchEvent(
          new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' })
        );
      }
    }
  }

  function pressEnter(el) {
    ['keydown', 'keypress', 'keyup'].forEach(function (type) {
      el.dispatchEvent(
        new KeyboardEvent(type, {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true
        })
      );
    });
  }

  function attemptSend(input, msg) {
    // Try 1: send button click
    const btn = findSendButton(input);
    if (btn && !btn.disabled) {
      btn.click();
      verifySent(input, msg, 'Send button');
      return;
    }
    // Try 2: form submit
    const form = input.closest && input.closest('form');
    if (form && form.requestSubmit) {
      try {
        form.requestSubmit();
        verifySent(input, msg, 'Form submit');
        return;
      } catch (e) {
        /* ignore */
      }
    }
    // Try 3: Enter key
    pressEnter(input);
    verifySent(input, msg, 'Enter key');
  }

  function markSent() {
    stats.sent++;
    updateStats();
  }

  function verifySent(input, msg, how) {
    setTimeout(function () {
      if (!input.isConnected) {
        markSent();
        setStatus('✅ "' + msg + '" gaya (' + how + ') @ ' + now());
        return;
      }
      if (inputText(input).trim() === '') {
        markSent();
        setStatus('✅ "' + msg + '" sent via ' + how + ' @ ' + now());
        return;
      }
      // Text abhi bhi pada hai — Enter se ek aur koshish
      pressEnter(input);
      setTimeout(function () {
        if (!input.isConnected || inputText(input).trim() === '') {
          markSent();
          setStatus('✅ "' + msg + '" sent via Enter (2nd try) @ ' + now());
        } else {
          setStatus('⚠️ Text type hua (' + how + ') par SEND nahi hua — input me pada hai');
        }
      }, 700);
    }, 700);
  }

  // ================= MAIN LOOP =================
  function tick() {
    if (!running) return;
    stats.lastTick = Date.now(); // heartbeat
    updateStats();
    try {
      // Safety limit
      const totalActions = stats.sent + stats.kw;
      if (
        stats.startedAt &&
        (totalActions >= MAX_ACTIONS ||
          Date.now() - stats.startedAt > MAX_HOURS * 3600000)
      ) {
        running = false;
        clearTimeout(timer);
        stopKeepAlive();
        stopWsKeepAlive();
        if (toggleBtnEl) {
          toggleBtnEl.textContent = '▶ Start';
          toggleBtnEl.style.background = '#22c55e';
          toggleBtnEl.style.color = '#052e16';
        }
        setStatus('🏁 Safety limit poori (' + totalActions + ' actions) — script khud ruki.');
        return;
      }

      // CAPTCHA guard
      const cp = captchaPresent();
      if (cp) {
        if (!captchaFlag) {
          stats.captcha++;
          updateStats();
        }
        captchaFlag = true;
        setStatus('🚨 CAPTCHA aa gaya! Ghar aake solve karna — tab tak script paused.');
        return;
      }
      captchaFlag = false;

      // Arena ka apna "Keep working" button dikhe toh wahi dabao
      const kw = findKeepWorking();
      if (kw) {
        if (!kwSeen) {
          // Insaan pehle padhta hai, phir dabata hai — ek cycle ruko
          kwSeen = true;
          setStatus('📖 Reply padh raha hoon… abhi Keep working dabayega');
          return;
        }
        kwSeen = false;
        kw.click();
        stats.kw++;
        updateStats();
        setStatus('✅ "Keep working" dabaya @ ' + now());
        return;
      }
      kwSeen = false;
      if (hasStopButton()) {
        setStatus('AI reply likh rahi hai… wait ⏳');
        return;
      }
      const input = findInput();
      if (!input) {
        setStatus('Is frame me input box nahi mila 😕');
        return;
      }
      if (input.disabled || input.readOnly) {
        setStatus('Input disabled hai — AI busy ⏳');
        return;
      }
      const existing = inputText(input).trim();
      if (existing !== '') {
        setStatus('✋ Input me text hai: "' + existing.slice(0, 30) + '" — skip');
        return;
      }
      const msg = pickMessage();
      setInputText(input, msg);
      setTimeout(function () {
        attemptSend(input, msg);
      }, 400);
    } catch (err) {
      setStatus('⚠️ Error: ' + err.message);
    }
  }
})();
