# Task: Bring Linux Quest into CyberQuest Academy

You are working in the CyberQuest Academy repository. CyberQuest is a public-facing
educational cybersecurity site (Next.js, deployed to AWS ECS in an LM-owned account).
High-school students and teachers reach it from their own machines: school Chromebooks,
locked-down laptops and home computers.

Your job: add **Linux Quest**, a capture-the-flag that teaches the Linux command line in a
simulated terminal, as a feature of CyberQuest. It must run in the existing Next.js
service, need no new infrastructure, and never execute a real command.

## Where the current version lives

A working static version exists in the GitLab project `pullen-teaching/ctf-test`
(gitlab.com). Read it before designing anything:

| File | What it is |
|---|---|
| `public/lite.js` | The simulated shell: in-memory filesystem with permissions, a parser (pipes, redirects, `;` `&&` `\|\|`, quotes, globs, `$(...)`), ~25 commands, real BusyBox `--help` texts, Tab completion and history, on xterm.js |
| `public/guide.js` | The mission panel: one mission at a time, run buttons, hints, Back/Next |
| `guest/mission`, `guest/hint` | The plain-text briefs and hints the `mission N` and `hint N` commands print |
| `tests-lite.mjs` | Playwright test that solves every mission with JIT disabled |
| `linux-quest-mission-1/` | The Killercoda version of the same missions (same texts) |

If you cannot reach that project from here, stop and ask me to attach those files. Do not
reconstruct them from this prompt.

## Step 0: explore, then propose (do not write feature code yet)

1. Read `CLAUDE.md` / `README` / contributing docs, and follow their conventions.
2. Find out:
   - the Next.js version and router (App or Pages);
   - auth and how a route gets the current user;
   - database and ORM, and how migrations are done;
   - test frameworks (unit and end-to-end);
   - lint and format rules;
   - `.gitlab-ci.yml` stages;
   - how the ECS deploy works;
   - any existing CTF, challenge or scoring models.
3. Reply with a short plan:
   - files to add or change;
   - data model changes;
   - any new dependency, with the reason;
   - open questions.

   Wait for my approval before implementing.

## Architecture I want

### 1. One shell engine for both client and server

Port `lite.js` to typed, framework-free TypeScript under `lib/quest/` (or the repo's
equivalent):
- **Split it up:** `parser.ts`, `fs.ts`, `shell.ts`, `commands/*.ts`, `missions.ts`, `world.ts`.
- **No DOM or browser APIs in the engine,** so the same code runs in Node.
- **Seeded world:** `buildWorld(seed)` is deterministic, using a seeded PRNG (not `Math.random`), so a world can be rebuilt from its seed instead of stored.
- **Overlay for changes:** files the student creates or changes live in a small overlay on top of the seeded world.

### 2. Two modes

- **Practice:** the engine runs in the browser. It works with no backend calls except `submit`.
- **Competition:** the browser does only line editing. Each entered line is a `POST` to an
  API route that runs the engine on the server against that user's world (seed plus
  overlay, persisted so any ECS task can serve the next request). Flags never reach the
  browser except as command output.

### 3. Flags and scoring on the server

- **Generation:** each user (or team) gets their own flags from
  `HMAC(serverSecret, userId + missionId + round)`, formatted `CYBA{word-8hex}`. The secret comes from the existing secrets mechanism, never the repo.
- **Checking:** `submit` calls `POST /api/quest/submit`, which uses a constant-time comparison, is rate-limited per user, and records the capture.
- **Scoreboard:** a scoreboard view (per event or round) for mentors.
- **Practice mode** may build flags client-side, as today, but `submit` still goes to the server.

### 4. UI

- **Terminal:** a `<QuestTerminal/>` client component wrapping xterm.js, loaded client-only
  (dynamic import, no SSR).
- **Competition clock:** counts up (never down), starts at the student's first keystroke in the terminal, stops when every flag is captured, and records the time of each capture.
- **Mission panel:** one mission at a time, to the right of the terminal (stacked on narrow screens), with a difficulty badge:
  - Back/Next, with Next locked until that mission's flag is accepted;
  - run buttons that type a command into the terminal;
  - a Hint disclosure;
  - progress dots.
- **Single source of truth:** mission text lives only in `missions.ts`. Both the panel and the `mission N` command render from it.
- **Accessibility:** keyboard reachable, visible focus, sufficient contrast.

### 5. Hard constraints

- **No WebSockets.** Corporate and school networks block them (this already broke
  Killercoda for us). Use plain `fetch` POSTs, plus server-sent events only if truly needed.
- **No WebAssembly or WASM-based emulators.** Some managed browsers disable WebAssembly
  (Chrome `DefaultJavaScriptJitSetting = 2`). Everything must work with
  `--js-flags=--jitless`.
- **Never execute real commands or `eval` input.** The shell is an interpreter over an
  in-memory model.
- **Limits:** cap input length, output size, pipeline length and command time.
- **Minimal data:** users are often minors. Store only what scoring needs (user id, mission,
  timestamp). Do not log raw terminal input.
- **No new AWS resources and no infrastructure changes** without asking me first.

## Missions

### Keep the existing six

Text, hints and file layout as in `ctf-test`; `guest/make-missions.py` is the single source
for the briefs. The hints name the command and point to its `--help`; they never give the
answer. Keep it that way.

Each mission carries a difficulty on CyberQuest's scale: Easy, Medium, Hard, Very Hard.
The six below are Easy, Easy, Easy, Medium, Medium, Hard; the two new ones should be Hard and Very Hard.

| # | Title | Skill |
|---|---|---|
| 1 | Make your move | `pwd`, `ls`, `cd`, `cd ..`: follow signpost file names through `town/`; the last folder holds a file named after the flag (no `cat` yet) |
| 2 | Let the cat out of the bag | `cat`, and `cat --help` to find `-n` (flag is on line N of a 100-line file where every line looks like a flag) |
| 3 | Now you see me | `ls -a`, hidden files, one decoy |
| 4 | Needle in the tree | `find -name` in about 80 files across 20 folders |
| 5 | Search party | `grep` in a 12,000-line access log |
| 6 | Decoder ring | `base64 -d` |

### Add two new ones

Both are simulated and served by the backend, with the same panel format and hint style.

**7. Knock knock (`curl`)**
- `README.txt` names a server, `http://vault-server.quest/`.
- The page body says "Nothing to see here. Servers say more than their page shows."
- The flag is in a response header (`X-Flag`), so the student must find `-i` or `-I` in
  `curl --help`.
- Implement `curl` as a command that calls an API route. The route answers only fake
  hostnames from a scripted table (status, headers, body). An unknown host returns
  `curl: (6) Could not resolve host: <host>`.
- There are no real outbound requests: no allowlist of real sites for now.

**8. Remote access (`ssh`)**
- A note found in mission 7's response body (or a file in `~/mission8`) gives an account
  `analyst@10.0.0.7` and a password.
- `ssh analyst@10.0.0.7` prompts for the password without echoing it, then switches the
  prompt to `analyst@vault-server:~$`, a second simulated machine with its own filesystem.
- The flag is in a hidden file in that home. `exit` returns to the student's machine.
- `ssh` with no arguments prints a realistic usage message, and `ssh --help` does too.

## Tests

- **Unit tests for the engine:**
  - the parser (quotes, pipes, redirects, `$(...)`);
  - permissions (cannot read `/etc/quest` answers or `/root`);
  - `--help` output for each command;
  - world determinism from a seed.
- **End-to-end test** (Playwright or the repo's tool) that solves all eight missions by typing
  into the terminal, in both practice and competition mode, run once with
  `--js-flags=--jitless`.
- **API tests** for `submit`: wrong flag, another user's flag, rate limit, replay.
- **No regressions:** existing tests, lint and type checks must stay green.

## Delivery

- Work on a feature branch named per the repo's convention. Make small commits.
- Open a GitLab merge request whose description covers:
  - what was built;
  - how to try it locally;
  - screenshots of the terminal and panel;
  - the data model change;
  - a short security notes section (how flags are generated, what is stored, input limits).
- Do not merge, do not deploy, and do not change ECS or Terraform. Tell me when the MR is
  ready and list anything you could not finish.
