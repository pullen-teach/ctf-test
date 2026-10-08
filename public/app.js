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
    bootText.textContent = "Starting Linux Quest lite mode…";
    setStatus("Starting lite mode…");
    meter.style.width = "60%";
    const tag = document.querySelector(".tag");
    window.quest = { emulator: null, done, lite: true };
    window.LinuxQuestLite.start(document.getElementById("terminal"), { onMission: markDone })
      .then(() => {
        meter.style.width = "100%";
        bootEl.classList.add("gone");
        if (tag) tag.textContent = "Lite mode";
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
    document.querySelector('.missions li[data-n="' + n + '"]')?.classList.add("done");
    document.querySelector('.step[data-n="' + n + '"]')?.classList.add("done");
    setStatus(done.size === 4 ? "All 4 flags captured" : done.size + " of 4 flags captured");
    if (done.size === 4) document.body.classList.add("won");
  }

  // For automated tests and mentors poking at the console.
  window.quest = { emulator, done };
})();
