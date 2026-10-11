# ⚡ Arena Auto Continue

**Latest: v2.0** — redesigned glassmorphism panel, color-coded status, live stat chips. ✨

Keep your Arena.ai agent working while you're away. It automatically sends
`continue` / `next` / `yes` / random positive messages, and clicks Arena's
**"Keep working"** button whenever the "Was this task successful?" box appears.

> Made for personal use on your own Arena account. 🙏

##  Features

- 📨 **Auto messages** — `continue`, `next`, `yes` or 🎲 *random positive* (English + Hinglish mix, sounds human)
- 🔁 **Auto "Keep working"** — clicks Arena's own continue button (and "reads" the reply for one cycle first, like a human 📖)
- ⏳ **Human-like timing** — random gaps every cycle + occasional 2–4 min "chai breaks" ☕
- 🚨 **CAPTCHA guard** — if a CAPTCHA shows up, the script pauses (never tries to bypass it) and resumes after you solve it
- 📊 **Live scoreboard** — messages sent, keep-working clicks, CAPTCHA count, runtime, and a 🕐 heartbeat
- 🛡️ **Safety auto-brake** — stops by itself after ~300 actions or 10 hours
- 🖱️ **Draggable + minimizable panel**, with a 📋 one-click report copy button
- 🔌 **Tab keep-alive** — silent audio + WebSocket tricks to keep the tab awake

## 🚀 Easiest install (console one-liner)

1. Open the Arena chat you want to automate.
2. Press `F12` → click the **Console** tab.
3. Paste this and press **Enter**:

```js
fetch('https://raw.githubusercontent.com/anuragkumarnishad/arena-auto-continue/main/arena-auto-continue-console.js').then(r=>r.text()).then(eval)
```

> If Chrome warns you about pasting, type `allow pasting` and press Enter first, then paste again.

4. The ⚡ panel appears → choose message mode (🎲 random positive recommended) → press **▶ Start**.

That's it. If the page ever reloads, just run the one-liner again.

## 🧩 Tampermonkey install (auto-loads every visit)

1. Install the [Tampermonkey](https://www.tampermonkey.net/) extension.
2. Create a new script, paste the full content of [`arena-auto-continue.user.js`](./arena-auto-continue.user.js), save (`Ctrl+S`).
3. Open any Arena chat — the panel appears automatically.

## 💡 Tips for leaving it running while you're away

- 🔌 Keep the laptop plugged in and set **Sleep = Never**.
- 🪟 Move the Arena tab into its **own small window** and leave it **visible** in a screen corner (don't minimize, don't cover it). Browsers only sleep hidden/minimized/covered tabs — a visible tab stays awake.
- 🧰 Extra insurance: open DevTools (`F12`), undock it to a separate window, and minimize that window. Chrome never freezes inspected tabs.
- ⏱️ Use **30–60 second** intervals. Very fast intervals look bot-like and invite CAPTCHAs.
- 🚨 If a CAPTCHA appears, the script waits patiently — solve it once when you're back and it resumes.

## 🛑 Stopping

Press **⏸ Stop** on the panel, or just close the tab.

## ⚠️ Disclaimer

This tool only automates *your own* clicks/typing in *your own* session — like a macro.
It never bypasses CAPTCHAs or any security check; it pauses and waits for a human.
Use responsibly and respect Arena's terms of service.

## 📄 License

MIT — see [LICENSE](./LICENSE).
