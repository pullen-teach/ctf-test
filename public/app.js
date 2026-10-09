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
  const TOTAL = 6;

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
  function startClock() {
    if (clockStart !== null) return;
    clockStart = performance.now();
    clockEl.classList.add("running");
    clockTimer = setInterval(tick, 250);
  }
  function stopClock() {
    if (clockStart === null || clockStop !== null) return;
    clockStop = performance.now();
    clearInterval(clockTimer); tick();
    clockEl.classList.remove("running"); clockEl.classList.add("stopped");
    clockEl.title = "Finished in " + fmt(elapsed());
  }
  window.questClock = { elapsed, fmt, text: () => fmt(elapsed()), start: () => startClock() };
  const termBox = document.getElementById("terminal");
  termBox.addEventListener("keydown", (e) => { if (!e.ctrlKey && !e.metaKey && !e.altKey) startClock(); }, true);
  termBox.addEventListener("paste", startClock, true);

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
    window.LinuxQuestLite.start(document.getElementById("terminal"), { onMission: markDone })
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

  const emulator = new V86({
    wasm_path: "v86/v86.wasm",
    bios: { url: "bios/seabios.bin" },
    vga_bios: { url: "bios/vgabios.bin" },
    bzimage: { url: "images/bzImage" },
    initrd: { url: "images/quest.cpio.gz" },
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

  emulator.add_listener("emulator-ready", () => {
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
      emulator.serial0_send("\n");
      setTimeout(() => {
        const term = document.querySelector("#terminal textarea");
        if (term) term.focus();
      }, 300);
    }
    const m = text.match(/\[quest\] mission (\d) complete/);
    if (m) markDone(Number(m[1]));
  });

  function markDone(n) {
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
