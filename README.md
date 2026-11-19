# ai-qa-agents-demo

A small, self-contained example of how I test role-based permissions in an API, and how AI agents fit into that work. `app/` is a tiny in-memory "workspace" API with four roles (Owner, Admin, Member, Guest), docs, sharing and member management. `tests/` holds 25 Playwright API tests built around a role x action permission matrix, plus negative cases (401, 403, 400, 404). `scripts/affected-tags.js` works out which tests a change needs, two GitHub workflows run them on every pull request and every night, and `.claude/agents/` has three Claude Code sub-agents that draft tests, run targeted checks and write bug reports, with a human reviewing every step. All data is fake: no real users, no credentials, no outside services.

## Architecture

```text
  changed files (git diff)                   ticket / failed test
           |                                          |
           v                                          v
  scripts/affected-tags.js                   .claude/agents/
  file -> area tags, e.g. "@docs|@sharing"   qa-tester | pr-checker | bug-writer
           |                                          |
           +--------------------+---------------------+
                                |  npx playwright test --grep "<tags>"
                                v
  tests/*.spec.js        Playwright Test, API only, no browser
                         fixtures.js: loginAs, newDoc, cleanup
                                |  HTTP + "Authorization: Bearer <token>"
                                v
  app/                   Express API, in-memory data
                         routes: auth | docs | sharing | members
                         BUGGY=1 turns on 2 planted bugs
                                |
                                v
  playwright-report/     HTML report  -->  a human checks every failure before a bug is filed

  CI   .github/workflows/pr-checks.yml   every PR: only the affected tests, report uploaded
       .github/workflows/nightly.yml     every night: full suite, plus a BUGGY=1 run that must fail
```

## Run it locally

Needs Node 20 or newer.

```bash
npm install
npm test                    # full suite: Playwright starts a fresh app on port 3100 by itself
npx playwright show-report  # the HTML report, with the steps of each test
```

With the planted bugs switched on (2 tests should fail):

```bash
BUGGY=1 npm test                                  # macOS, Linux, Git Bash
$env:BUGGY='1'; npm test; Remove-Item Env:BUGGY   # Windows PowerShell
```

Only the tests a change needs:

```bash
node scripts/affected-tags.js app/routes/members.js   # prints @members
npm run test:affected -- app/routes/members.js        # runs those 7 tests
```

To try the API by hand: `npm start` (port 3000), then `POST /api/login` with `{"email": "member@example.com"}`, and send the token you get back as `Authorization: Bearer <token>`. Seeded users: `owner@`, `admin@`, `member@`, `member2@` and `guest@example.com`.

## Permission matrix

| Action | Owner | Admin | Member | Guest |
|---|---|---|---|---|
| See docs | all | all | all | only docs shared with them |
| Create a doc | yes | yes | yes | no (403) |
| Edit a doc | yes | yes | yes | no (403) |
| Delete their own doc | yes | yes | yes | - |
| Delete another member's doc | yes | yes | no (403) | no (403) |
| Share a doc with a guest, or remove access | yes | yes | yes | no (403) |
| Add or remove members | yes | yes | no (403) | no (403) |

Also: nobody can remove the Owner (403). A doc a guest can't see answers 404, not 403, so guests can't probe which docs exist. A missing or unknown token gets 401.

`tests/permission-matrix.spec.js` turns three of these rows into data: one test per role per row, 12 in total. Adding a row to that table adds four tests.

## Tests

| Spec | Tag | Tests | What it covers |
|---|---|---|---|
| permission-matrix.spec.js | @docs, @members | 12 | create a doc, delete another member's doc, add a member: each for all 4 roles |
| auth.spec.js | @auth | 3 | login for every role, bad login (400, 401), missing or bad token (401) |
| docs.spec.js | @docs | 3 | create-read-edit-delete flow, bad input (400), unknown id (404) |
| sharing.spec.js | @sharing | 4 | guest read-only access, hidden docs (404), removing access, who can share |
| members.spec.js | @members | 3 | a removed member loses access at once, the Owner can't be removed, bad input (400, 409) |

Each test creates its own data and deletes it afterwards, even when it fails (the `cleanup` fixture in `tests/fixtures.js`). That's why the tests can run in parallel and in any order.

## Planted bugs (BUGGY=1)

| # | Bug | Where | Caught by |
|---|---|---|---|
| 1 | A Member can delete another member's doc | `app/routes/docs.js` | "Member cannot delete another member's doc (403)" |
| 2 | Removing a guest's access answers 204, but the guest can still open the doc | `app/routes/sharing.js` | "removing a guest really takes their access away" |

Bug 2 is the kind a status-code-only test misses: the API says "done", so the test has to check the effect too. The nightly workflow runs the suite with `BUGGY=1` to prove both bugs are still caught.

## Targeted runs

`scripts/affected-tags.js` maps changed files to test tags (the `AREA_TAGS` table at the top of the script). When it's unsure, it runs everything: a few extra tests cost less than a missed regression.

```text
$ node scripts/affected-tags.js app/routes/docs.js
@docs|@sharing     docs routes also decide what guests can see, so sharing tests run too
$ node scripts/affected-tags.js app/store.js
.*                 shared by every area, so the full suite
```

With no file arguments (as in CI) it reads `git diff --name-only origin/main...HEAD` itself. It prints only the pattern on stdout and the reason on stderr, so the pattern is easy to capture.

## How the AI agents fit in

1. **Human plans.** I decide the roles, the actions and the expected result of each pair. That's the matrix above, and it's the spec.
2. **Agents draft and run** (`.claude/agents/`):
   - `qa-tester` turns one ticket's expected results into a spec, runs it and returns Pass/Fail with evidence.
   - `pr-checker` maps a PR's changed files to tags and runs only those tests.
   - `bug-writer` turns a confirmed failure into a draft bug report: steps, expected, actual, evidence.
3. **Human reviews.** I read every new test before it's merged (do the expected values come from the spec, or from whatever the app does today?), and I re-check every failure myself before a bug is filed.

To use them, open this folder in Claude Code and ask, for example, "Use the pr-checker agent on this branch."

Built with Claude Code as a pair; I designed the role matrix and review every test.

## Case study: how I set up AI-agent QA for a SaaS team

**The problem.** Every release needed the same manual re-tests: sign in as each role, walk through the permission rules, re-check old bugs. It was slow, and releases waited on it.

**The setup.** I moved the repeatable checks into API tests and gave AI agents small jobs with clear inputs and outputs. One checks each PR by running only the tests for the areas it touches. One turns a ticket's expected results into a test and runs it. One turns a failure into a draft bug with the exact requests and responses. A human stays at both ends: I decide what gets tested, and I review every test and every failure.

**What worked.** Targeted runs gave feedback while a change was still fresh. Writing the role matrix down first made gaps easy to spot. Bug drafts with the exact requests and responses were quicker to triage than "it's broken".

**What didn't.** Early checks used fixed waits and were flaky, until they waited for real conditions instead. The agents also raised false alarms: failures that were really test mistakes or environment problems. And they sometimes wrote assertions that matched what the app did, bug included. So a human re-runs every failure and checks every expected value against the spec before anything is filed.
