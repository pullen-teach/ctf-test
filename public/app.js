// Linux Quest in the browser: boots a small Linux (kernel + BusyBox) inside
// v86, shows its serial console in xterm.js, and watches the console for
// "[quest] ..." markers to update the page.
(function () {
  "use strict";

  const statusEl = document.getElementById("status");
  const bootEl = document.getElementById("boot");
  const bootText = document.getElementById("boot-text");
  const meter = document.getElementById("meter-fill");
  const started = performance.now();
  const done = new Set();
  const TOTAL = 10;

  // Competition clock: counts up from the first key typed in the terminal (or the
  // first Run button) and stops when every flag is captured. It never cuts anyone off.
  const clockEl = document.getElementById("clock");
  const clockText = document.getElementById("clock-time");
  let clockStart = null, clockStop = null, clockTimer = null;
  function fmt(ms) {
    const t = Math.floor(ms / 1000), h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, sec = t % 60;
    const p2 = (n) => String(n).padStart(2, "0");
    return (h ? h + ":" + p2(m) : p2(m)) + ":" + p2(sec);
  }
  const elapsed = () => (clockStart === null ? 0 : (clockStop ?? performance.now()) - clockStart);
  function tick() { clockText.textContent = fmt(elapsed()); }
  // The warm-up (mission 0) is untimed: the clock waits until it is captured or skipped.
  function startClock() {
    if (clockStart !== null) return;
    if (window.questGuide && !window.questGuide.warmupOver()) return;
    clockStart = performance.now();
    clockEl.classList.add("running");
    const lab = document.getElementById("clock-label"); if (lab) lab.textContent = "Elapsed Time";
    clockTimer = setInterval(tick, 250);
  }
  function stopClock() {
    if (clockStart === null || clockStop !== null) return;
    clockStop = performance.now();
    clearInterval(clockTimer); tick();
    clockEl.classList.remove("running"); clockEl.classList.add("stopped");
    const lab = document.getElementById("clock-label"); if (lab) lab.textContent = "Final Time";
    clockEl.title = "Finished in " + fmt(elapsed());
  }
  window.questClock = { elapsed, fmt, text: () => fmt(elapsed()), start: () => startClock() };
  const termBox = document.getElementById("terminal");
  termBox.addEventListener("keydown", (e) => { if (!e.ctrlKey && !e.metaKey && !e.altKey) startClock(); }, true);
  termBox.addEventListener("paste", startClock, true);

  // xterm.js turns Ctrl+V into ^V, so the browser never pastes. Hand Ctrl+V (and
  // Ctrl+Shift+V) back to the browser: its paste event reaches the terminal as typed
  // text. Ctrl+C copies when text is selected, otherwise it stays the usual ^C.
  window.questClipboardKeys = (term) => {
    if (!term || !term.attachCustomKeyEventHandler) return;
    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== "keydown" || !(e.ctrlKey || e.metaKey) || e.altKey) return true;
      const k = e.key.toLowerCase();
      if (k === "v") return false;
      if (k === "c" && term.hasSelection()) {
        const t = term.getSelection();
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).catch(() => {});
        e.preventDefault();
        return false;
      }
      return true;
    });
    // Mouse, like a Linux terminal: highlighting copies, middle-click pastes what you
    // highlighted, right-click pastes (or copies, when text is highlighted).
    let primary = "";
    const toClipboard = (t) => { if (t && navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).catch(() => {}); };
    const paste = (t) => { if (!t) return; startClock(); term.paste(t); term.focus(); };
    term.onSelectionChange(() => { const t = term.getSelection(); if (t) { primary = t; toClipboard(t); } });
    const box = term.element;
    if (!box) return;
    box.addEventListener("mousedown", (e) => { if (e.button === 1) { e.preventDefault(); paste(primary); } }, true);
    ["mouseup", "auxclick"].forEach((ev) => box.addEventListener(ev, (e) => { if (e.button === 1) e.preventDefault(); }, true));
    box.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (term.hasSelection()) { toClipboard(term.getSelection()); term.clearSelection(); return; }
      if (navigator.clipboard && navigator.clipboard.readText && window.isSecureContext)
        navigator.clipboard.readText().then((t) => paste(t || primary), () => paste(primary));
      else paste(primary);
    });
  };

  function setStatus(text) {
    statusEl.textContent = text;
  }
  function seconds() {
    return ((performance.now() - started) / 1000).toFixed(1);
  }

  // v86 needs WebAssembly. Some managed browsers (work laptops, locked-down
  // school devices) switch it off by policy, e.g. Chrome's
  // DefaultJavaScriptJitSetting = 2. Then run lite mode (lite.js): a simulated
  // shell with the same missions. Add ?lite to the address to force it.
  const forceLite = new URLSearchParams(location.search).has("lite");
  if (typeof WebAssembly !== "object" || forceLite) {
    bootText.textContent = "Starting CyberQuest lite mode…";
    setStatus("Starting lite mode…");
    meter.style.width = "60%";
    window.quest = { emulator: null, done, lite: true };
    window.questGuide.setRunner((cmd) => { startClock(); window.LinuxQuestLite.typeLine(cmd); });
    window.LinuxQuestLite.start(document.getElementById("terminal"), { onMission: markDone, onHint: (n, k) => window.questGuide.hintUsed(n, k) })
      .then(() => {
        meter.style.width = "100%";
        bootEl.classList.add("gone");
        setStatus("Ready (lite mode) in " + seconds() + " s");
        window.questReadySeconds = Number(seconds());
      })
      .catch((e) => {
        bootText.textContent = "Lite mode could not start: " + e.message;
        setStatus("Can't start");
      });
    return;
  }

  // A page can set window.QUEST_CONFIG = { base: "../", initrd: "crypto.cpio.gz" } to share
  // the emulator files with the Linux CTF and boot its own missions.
  const CFG = window.QUEST_CONFIG || {}, BASE = CFG.base || "";
  const emulator = new V86({
    wasm_path: BASE + "v86/v86.wasm",
    bios: { url: BASE + "bios/seabios.bin" },
    vga_bios: { url: BASE + "bios/vgabios.bin" },
    bzimage: { url: BASE + "images/bzImage" },
    initrd: { url: CFG.initrd || "images/quest.cpio.gz" },
    cmdline: "console=ttyS0 quiet loglevel=3 tsc=reliable mitigations=off",
    memory_size: 128 * 1024 * 1024,
    vga_memory_size: 2 * 1024 * 1024,
    serial_container_xtermjs: document.getElementById("terminal"),
    disable_keyboard: true,
    disable_mouse: true,
    disable_speaker: true,
    acpi: false,
    fastboot: true,
    autostart: true,
  });

  emulator.add_listener("download-progress", (e) => {
    if (e.lengthComputable && e.total) {
      const pct = Math.round((100 * e.loaded) / e.total);
      meter.style.width = Math.min(60, pct * 0.6) + "%";
      setStatus("Downloading Linux… " + pct + "%");
    }
  });

  // v86 makes an 80x25 terminal. Give it as many rows as the panel can show, so
  // the screen is used top to bottom and the scrollbar matches the content.
  function fitRows() {
    const term = emulator.serial_adapter && emulator.serial_adapter.term;
    const row = document.querySelector("#terminal .xterm-rows > div");
    const box = document.getElementById("terminal");
    if (!term || !row || !box) return;
    const h = row.getBoundingClientRect().height;
    if (!h) return;
    const rows = Math.max(12, Math.floor((box.clientHeight - 2) / h));
    if (rows !== term.rows) term.resize(term.cols, rows);
  }
  window.addEventListener("resize", fitRows);

  emulator.add_listener("emulator-ready", () => {
    window.questClipboardKeys(emulator.serial_adapter && emulator.serial_adapter.term);
    fitRows();
    meter.style.width = "70%";
    bootText.textContent = "Booting Linux…";
    setStatus("Booting Linux…");
  });

  // Watch the console output for markers printed by the guest.
  let line = "";
  emulator.add_listener("serial0-output-byte", (byte) => {
    const ch = String.fromCharCode(byte);
    if (ch !== "\n") {
      line += ch;
      if (line.length > 400) line = line.slice(-400);
      return;
    }
    const text = line.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "");
    line = "";
    if (text.includes("[quest] building")) {
      meter.style.width = "85%";
      bootText.textContent = "Hiding your flags…";
      setStatus("Hiding your flags…");
      window.questBootSeconds = Number(seconds());
    }
    if (text.includes("[quest] ready")) {
      meter.style.width = "100%";
      bootEl.classList.add("gone");
      setStatus("Ready in " + seconds() + " s");
      window.questReadySeconds = Number(seconds());
      fitRows();
      setTimeout(() => {
        const term = document.querySelector("#terminal textarea");
        if (term) term.focus();
      }, 300);
    }
    const hm = text.match(/\[quest\] hint (\d+)\.(\d+) used/);
    if (hm) window.questGuide.hintUsed(Number(hm[1]), Number(hm[2]));
    const m = text.match(/\[quest\] mission (\d+) complete/);
    if (m) markDone(Number(m[1]));
  });

  function markDone(n) {
    if (n === 0) { window.questGuide.done(0, 0); return; }   // warm-up: bonus points, not one of the TOTAL flags
    if (done.has(n)) return;
    done.add(n);
    if (done.size === TOTAL) stopClock();
    window.questGuide.done(n, window.questClock.elapsed());
    document.querySelector('.step[data-n="' + n + '"]')?.classList.add("done");
    setStatus(done.size === TOTAL ? "All " + TOTAL + " flags captured" : done.size + " of " + TOTAL + " flags");
    if (done.size === TOTAL) document.body.classList.add("won");
  }

  // The panel's run buttons type straight into the guest's console.
  window.questGuide.setRunner((cmd) => {
    startClock();
    emulator.serial0_send(cmd + "\n");
    document.querySelector("#terminal textarea")?.focus();
  });

  // For automated tests and mentors poking at the console.
  window.quest = { emulator, done };
})();
