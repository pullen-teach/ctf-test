# Task: Add the CyberQuest Linux CTF to CyberQuest Academy

You are working in the CyberQuest Academy repository. CyberQuest is a public-facing
educational cybersecurity site (Next.js, deployed to AWS ECS in an LM-owned account).
High-school students and teachers reach it from their own machines: school Chromebooks,
locked-down laptops and home computers.

Your job: add the **CyberQuest Linux CTF**, a simulated capture-the-flag competition that
teaches the Linux command line in a browser terminal, as a feature of CyberQuest. It must
run in the existing Next.js service, need no new infrastructure, and never execute a real
command.

## The reference version

A working static version lives in the GitLab project `pullen-teaching/ctf-test` on gitlab.com.
You can see it running at `https://pullen-teaching.gitlab.io/ctf-test/?lite`; `?lite` forces
the simulated shell this port is based on. Read the code before designing anything:

| File | What it is |
|---|---|
| `public/lite.js` | The simulated shell: in-memory filesystem with permissions, a parser (pipes, redirects, `;` `&&` `\|\|`, quotes, globs, `$(...)`), ~25 commands, real BusyBox `--help` texts, Tab completion and history, on xterm.js |
| `public/guide.js` | The mission panel: one mission at a time, difficulty badge, run buttons, hint, Back/Next gating, capture times and the finish screen |
| `public/app.js` | The competition clock and how flag captures reach the page |
| `public/index.html`, `public/style.css` | Layout: header (brand, pill, progress track, clock), terminal on the left, panel on the right |
| `guest/make-missions.py` | **The single source of every mission brief, hint, difficulty and run command.** It generates the panel data, the `mission`/`hint` command text and the Killercoda steps |
| `guest/make-banner.py` | Builds the terminal's welcome banner (ANSI colors, wide and compact versions) |
| `tests-lite.mjs` | Playwright test that solves every mission with JIT disabled |

The reference also has a real-Linux mode (the v86 emulator) and a Killercoda version. Ignore both
for this port: CyberQuest gets only the simulated shell.

If you cannot reach that project from here, stop and ask me to attach those files. Do not
reconstruct them from this prompt.

## Step 0: explore, then propose (do not write feature code yet)

1. Read `CLAUDE.md`, `README` and any contributing docs, and follow their conventions.
2. Find out:
   - the Next.js version and router (App or Pages);
   - auth, and how a route gets the current user;
   - the database and ORM, and how migrations are done;
   - test frameworks (unit and end-to-end);
   - lint and format rules;
   - the `.gitlab-ci.yml` stages;
   - how the ECS deploy works;
   - any existing CTF, challenge, event or scoring models to reuse.
3. Reply with a short plan:
   - files to add or change;
   - data model changes;
   - any new dependency, with the reason;
   - open questions.

   Wait for my approval before implementing.

## Architecture

### 1. One shell engine for client and server

Port `lite.js` to typed, framework-free TypeScript under `lib/quest/` (or the repo's
equivalent):
- **Split it up:** `parser.ts`, `fs.ts`, `shell.ts`, `commands/*.ts`, `missions.ts`, `world.ts`.
- **No DOM or browser APIs in the engine,** so the same code runs in Node.
- **Seeded world:** `buildWorld(seed)` is deterministic, using a seeded PRNG (not `Math.random`), so a world can be rebuilt from its seed instead of stored.
- **Overlay for changes:** files the student creates or changes live in a small overlay on top of the seeded world.

### 2. Two modes

- **Practice:** the engine runs in the browser, with no backend calls except `submit`.
- **Competition:** the browser does only line editing. Each entered line is a `POST` to an API
  route that runs the engine on the server against that user's world (seed plus overlay,
  persisted so any ECS task can serve the next request). Flags never reach the browser
  except as command output.

### 3. Flags and scoring on the server

- **Format:** `CYBA{word-8hex}`, for example `CYBA{moves-1a2b3c4d}`.
- **Generation:** each user (or team) gets their own flags from
  `HMAC(serverSecret, userId + missionId + round)`. The secret comes from the existing secrets mechanism, never the repo.
- **Checking:** `submit` calls `POST /api/quest/submit`, which:
  - uses a constant-time comparison;
  - is rate-limited per user;
  - records the capture with its clock time.
- **Wrong flags:** the reply is `Not a flag. Copy the whole thing, CYBA{ to }.`
- **Points and the scoreboard:** see *Scoring and scoreboard* below.
- **Practice mode** may build flags client-side, but `submit` still goes to the server.

### 4. UI: match the reference

- **Header:**
  - "CyberQuest" with a **Linux CTF** pill;
  - a progress track with one segment per mission, each a different color when captured;
  - the student's score as `points / max pts`, which pops briefly when it goes up;
  - in competition mode, their rank, for example "#4 of 23";
  - the competition clock;
  - a status line.
- **Competition clock:**
  - counts **up**, never down, and never cuts anyone off;
  - shows `mm:ss`, switching to `h:mm:ss` after an hour;
  - starts at the student's first keystroke or paste in the terminal, or the first click of a run button;
  - stops when every flag is captured, then turns green;
  - in competition mode, the server records the start and capture times so a page reload cannot reset the clock.
- **Terminal (left):**
  - a `<QuestTerminal/>` client component wrapping xterm.js, loaded client-only (dynamic import, no SSR);
  - opens with the welcome banner from `guest/make-banner.py`, using the compact version on narrow terminals.
- **Mission panel (right; below the terminal on narrow screens), one mission at a time:**
  - "Mission N of 6" with numbered dots: captured ones turn green and can be clicked to revisit;
  - title with a difficulty badge showing level and points, for example "Medium · 200";
  - a "Start here" block of run buttons that type a command into the terminal;
  - the brief, and a "Useful commands" card;
  - a "Found the flag? Worth N points" card that becomes "+N points, captured at mm:ss on the clock";
  - a "Need a hint?" disclosure;
  - a sticky footer with Back and Next, where Next stays locked until that mission's flag is accepted.
- **Finish screen:** "1100 / 1100 points in mm:ss", then a scorecard table (mission, points,
  capture time, total), the closing "Encoding is not encryption" lesson, and an invitation to
  beat their time.
- **Terminal commands:**
  - `mission` lists the missions with their difficulty, and `mission N` prints the same brief as the panel;
  - `hint N` names the command to look up and points to its `--help`;
  - `submit CYBA{...}` checks a flag and replies `Correct! +N points`.
- **Single source of truth:** mission content lives only in `missions.ts`, carrying title, difficulty, points, run commands, brief, useful commands and hint. The panel and the `mission`/`hint` commands render from it, as `make-missions.py` does today.
- **Accessibility:** everything keyboard reachable, visible focus, sufficient contrast, and the clock's blink respects reduced motion.

### 5. Hard constraints

- **No WebSockets.** Corporate and school networks block them; this already broke Killercoda
  for us. Use plain `fetch` POSTs, plus server-sent events only if truly needed.
- **No WebAssembly or WASM-based emulators.** Some managed browsers disable WebAssembly
  (Chrome `DefaultJavaScriptJitSetting = 2`). Everything must work under
  `--js-flags=--jitless`.
- **Never execute real commands or `eval` input.** The shell is an interpreter over an in-memory model.
- **Limits:** cap input length, output size, pipeline length and command time.
- **Minimal data:** users are often minors. Store only what scoring needs (user id, mission,
  timestamps). Do not log raw terminal input.
- **No new AWS resources and no infrastructure changes** without asking me first.

## Missions

### Keep the existing six

Keep the text, hints, run commands and world layout from `guest/make-missions.py` and `lite.js`.
- **Hints never give the answer.** They name the command and point to its `--help`.
- **Randomized worlds:** names, hiding places and flags vary per user, so neighbors cannot share answers.
- **Difficulty** uses CyberQuest's scale, and sets the points: Easy 100, Medium 200, Hard 400, Very Hard 800.

| # | Title | Level (pts) | Skill |
|---|---|---|---|
| 1 | Make your move | Easy (100) | `pwd`, `ls`, `cd`, `cd ..`, `cd ~`. Signpost **file names** in `~/mission1/town/` lead the way, including a dead end. The last folder holds a file *named* after the flag. No `cat` yet |
| 2 | Let the cat out of the bag | Easy (100) | `cat`, then `cat --help` to find `-n`. The flag is on line N (named in `README.txt`) of a 100-line `bag.txt` where every line looks like a flag |
| 3 | Now you see me | Easy (100) | `ls -a`: a hidden file holds the flag, and another hidden file is a decoy |
| 4 | Needle in the tree | Medium (200) | `find -name` with a pattern, in about 80 files across 20 folders |
| 5 | Search party | Medium (200) | `grep` for one intruder's line in a 12,000-line `access.log` |
| 6 | Decoder ring | Hard (400) | `base64 -d`; the lesson is "encoding is not encryption" |

### Add two new ones

Both are simulated and served by the backend, using the same panel format and hint style.

**7. Knock knock (`curl`): Hard, 400 points**
- `README.txt` names a server, `http://vault-server.quest/`.
- The page body says "Nothing to see here. Servers say more than their page shows."
- The flag is in a response header (`X-Flag`), so the student must find `-i` or `-I` in `curl --help`.
- `curl` calls an API route that answers only fake hostnames from a scripted table (status, headers, body).
- An unknown host returns `curl: (6) Could not resolve host: <host>`.
- There are no real outbound requests: no allowlist of real sites for now.

**8. Remote access (`ssh`): Very Hard, 800 points**
- A note in mission 7's response body (or a file in `~/mission8`) gives an account,
  `analyst@10.0.0.7`, and a password.
- `ssh analyst@10.0.0.7` prompts for the password without echoing it, then switches the prompt to
  `analyst@vault-server:~$`, a second simulated machine with its own filesystem.
- The flag is in a hidden file in that home, and `exit` returns to the student's machine.
- `ssh` with no arguments prints a realistic usage message, and so does `ssh --help`.

## Scoring and scoreboard

### Points

| Level | Points |
|---|---|
| Easy | 100 |
| Medium | 200 |
| Hard | 400 |
| Very Hard | 800 |

- **Totals:** the six current missions total 1,100 points; with missions 7 and 8 the total is 2,300.
- **Once per mission:** a mission scores once per competitor, so resubmitting a flag adds nothing.
- **Points are fixed at capture time:** store the points on each capture, so later rebalancing never changes past results.

### Events

- **Created by a mentor:** an event has a name, which missions it includes, solo or team mode, and a join code that students enter.
- **Open and close:** the mentor opens and closes the event. Submissions after close are refused.
- **Team mode:** members share one world seed, one set of flags and one score. A capture by any member counts for the team.
- **Freeze (optional):** the mentor can freeze the public board for the last N minutes, standard for CTFs. Captures still count and appear when the mentor unfreezes.
- **Results export:** mentors can download the final standings as CSV.

### Ranking

1. Most points.
2. Tie-break: the lower elapsed time on the competitor's own clock at their last scoring capture.
3. Same tie-break for the rank shown in the student's header.

### Scoreboard page

- **Columns:** rank, display name, points, one marker per mission (filled with its level color when solved), and elapsed time at last capture. Highlight the top three.
- **Live updates by polling** every 10 to 15 seconds. No WebSockets.
- **Projector mode** for showing on the classroom screen: full-screen, dark, large type, and auto-scrolling when the list is long.
- **No real names on the public board.** Students pick a display name (or the team gets one), and mentors can edit or hide any name. This matters because competitors are often minors.

### Mentor view

- **Everything on the scoreboard,** plus each competitor's per-mission capture times.
- **Flag sharing:** a submit of a flag that belongs to another competitor is refused like any wrong flag. It is also logged on the mentor view only, so mentors can spot sharing without the student being told whose flag it was.

### Data

- **Store only:** events, competitors (display name, team, user id) and captures (competitor, mission, points, elapsed ms, timestamp).
- **No raw terminal input.**

## Tests

- **Unit tests for the engine:**
  - the parser (quotes, pipes, redirects, `$(...)`);
  - permissions (cannot read `/etc/quest` or `/root`);
  - `--help` output for each command;
  - world determinism from a seed.
- **Clock tests:**
  - it does not start on page load;
  - it starts on the first keystroke;
  - it stops when the last flag is captured;
  - in competition mode, it survives a reload.
- **End-to-end test** (Playwright or the repo's tool) that solves all eight missions by typing into
  the terminal, the way `tests-lite.mjs` walks Mission 1's signposts with `ls` and `cd`. Run it in
  practice and competition mode, and once with `--js-flags=--jitless`.
- **API tests for `submit`:**
  - wrong flag;
  - another competitor's flag (refused, and logged for mentors);
  - rate limit;
  - replay (no double points);
  - submit after the event closes.
- **Scoreboard tests:**
  - ranking and the tie-break;
  - team scoring;
  - freeze and unfreeze;
  - display-name hiding;
  - CSV export.
- **No regressions:** existing tests, lint and type checks stay green.

## Delivery

- Work on a feature branch named per the repo's convention, with small commits.
- Open a GitLab merge request whose description covers:
  - what was built;
  - how to try it locally;
  - screenshots of the banner, a mission with its difficulty and points badge, the running clock and score, the finish scorecard, and the scoreboard in normal and projector mode;
  - the data model change;
  - a short security notes section: how flags are generated, what is stored, input limits.
- Do not merge, do not deploy, and do not change ECS or Terraform. Tell me when the MR is ready
  and list anything you could not finish.
