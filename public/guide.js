// The mission guide on the left: one mission at a time, like a Killercoda
// scenario. A mission's "Next" button unlocks when its flag is accepted.
// app.js calls questGuide.done(n) when a flag is captured, and
// questGuide.setRunner(fn) so the "run" blocks can type into the terminal.
(function () {
  "use strict";

  const MISSIONS = [
    {
      title: "Let the cat out of the bag",
      run: ["cd ~/mission1", "cat README.txt"],
      body: [
        "<code>cat</code> prints a file on the screen. You just used it to read <code>README.txt</code>.",
        "The cat is hiding in <code>bag.txt</code>: 100 lines, and every one looks like a flag. Only the line number in <code>README.txt</code> is real. Counting 100 lines by hand is how mistakes happen.",
        "Almost every Linux command can <b>explain itself</b>: type its name, a space, then <code>--help</code>. Ask <code>cat</code> for its help and look for an option that numbers the lines. You will use <code>--help</code> in every mission after this one.",
      ],
      useful: ["cat"],
      hint: "Read the help for <code>cat</code> and look for the option that <b>numbers</b> the lines. Options go between the command and the file name.<pre>cat --help</pre>",
    },
    {
      title: "Now you see me",
      run: ["cd ~/mission2"],
      body: [
        "There is a flag in this folder, but plain <code>ls</code> will not show it.",
        "On Linux, a file whose name starts with a dot is <b>hidden</b>. Watch out: one hidden file is a decoy.",
      ],
      useful: ["ls", "cat"],
      hint: "Read the help for <code>ls</code> and look for an option that also shows names starting with <code>.</code><pre>ls --help</pre>",
    },
    {
      title: "Needle in the tree",
      run: ["cd ~/mission3", "cat README.txt"],
      body: [
        "The <code>archive</code> folder holds about 80 files in 20 folders. Exactly <b>one</b> of them has the file ending named in <code>README.txt</code>, and it holds the flag.",
        "Opening folders one by one is too slow. Let the computer search.",
      ],
      useful: ["find", "cat"],
      hint: "Read the help for <code>find</code> and look for a way to match a file's <b>name</b> against a pattern. In a pattern, <code>*</code> means \"anything\".<pre>find --help</pre>",
    },
    {
      title: "Search party",
      run: ["cd ~/mission4", "cat README.txt"],
      body: [
        "<code>access.log</code> has 12,000 lines. One intruder logged in exactly once.",
        "Their <b>token</b> on that line is the flag. Scrolling would take all day.",
      ],
      useful: ["grep", "head", "wc"],
      hint: "Read the help for <code>grep</code> and look at the <b>Usage</b> line at the top: it shows what goes first and what goes second.<pre>grep --help</pre>",
    },
    {
      title: "Decoder ring",
      run: ["cd ~/mission5", "cat message.b64"],
      body: [
        "It looks like gibberish, but it is not encrypted. It is <b>encoded</b> with base64: a way of writing any data using only letters, digits, <code>+</code>, <code>/</code> and <code>=</code>.",
        "There is no secret key. Anyone can decode it.",
      ],
      useful: ["base64"],
      hint: "Read the help for <code>base64</code> and look for the option that turns base64 back into normal text.<pre>base64 --help</pre>",
    },
  ];

  const N = MISSIONS.length;
  const done = new Set();
  let current = 0;
  let runner = null;

  const el = (id) => document.getElementById(id);
  const article = el("mission");
  const count = el("m-count");
  const prev = el("prev");
  const next = el("next");
  const state = el("m-state");
  const dots = el("m-dots");

  function render() {
    const m = MISSIONS[current];
    const n = current + 1;
    count.textContent = "Mission " + n + " of " + N;
    const runs = m.run.map((c) => '<button class="run" type="button" data-cmd="' + c + '" title="Click to type this into the terminal"><span class="run-cmd">' + c + '</span><span class="run-go" aria-hidden="true">&#9654;</span></button>').join("");
    article.innerHTML =
      '<h2>Mission ' + n + ': ' + m.title + '</h2>' +
      '<div class="runs">' + runs + '</div>' +
      m.body.map((p) => "<p>" + p + "</p>").join("") +
      '<p class="useful"><b>Useful ' + (m.useful.length > 1 ? "commands" : "command") + ':</b> ' + m.useful.map((u) => "<code>" + u + "</code>").join(", ") + "</p>" +
      '<p class="submit-line">When you have the flag, type <code>submit</code> and paste it, for example <code>submit CQ{word-1a2b3c4d}</code></p>' +
      '<details class="hint"><summary>Hint</summary><div>' + m.hint + "</div></details>";
    article.querySelectorAll(".run").forEach((b) => b.addEventListener("click", () => { if (runner) runner(b.dataset.cmd); }));
    const ok = done.has(n);
    state.textContent = ok ? "Flag captured" : "";
    state.className = ok ? "m-state ok" : "m-state";
    prev.disabled = current === 0;
    next.disabled = !ok;
    next.textContent = current === N - 1 ? "Finish" : "Next mission";
    dots.querySelectorAll("span").forEach((d, i) => {
      d.className = (i === current ? "here " : "") + (done.has(i + 1) ? "ok" : "");
    });
    article.scrollTop = 0;
  }

  function finish() {
    count.textContent = "Quest complete";
    article.innerHTML =
      "<h2>All " + N + " flags captured</h2>" +
      "<p>You let the cat out of the bag with <code>--help</code>, found hidden files, searched folders and a 12,000-line log, and decoded a message that only looked secret.</p>" +
      "<p><b>Encoding is not encryption.</b> If no key is needed to undo it, it was never secret.</p>" +
      "<p>Reload the page for a fresh computer with new flags, and see how fast you can do it again.</p>";
    state.textContent = "";
    next.disabled = true;
    prev.disabled = false;
    dots.querySelectorAll("span").forEach((d) => (d.className = "ok"));
    current = N;
  }

  prev.addEventListener("click", () => { if (current > 0) { current = Math.min(current, N) - 1; render(); } });
  next.addEventListener("click", () => {
    if (current === N - 1) { if (done.size === N) finish(); return; }
    if (done.has(current + 1)) { current++; render(); }
  });

  dots.innerHTML = MISSIONS.map(() => "<span></span>").join("");
  render();

  window.questGuide = {
    done(n) { done.add(n); if (current < N) render(); },
    setRunner(fn) { runner = fn; },
    current: () => current + 1,
  };
})();
