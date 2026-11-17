# Validation

Use the same scope classifier locally and in Actions. Edit canonical `data-src`, not generated `public/data`.

```sh
python3 tools/validate_changes.py
```

This preflight rebuilds data and precache, runs **all Node mathematics/property tests and all Python tests**, then checks changed questions on desktop/mobile: text, original images, KaTeX, and overflow. Review/stage refreshed generated files. It does not stage, commit, push, alter hooks, or publish anything.

`npm test` already includes repository-wide ESLint, strict positive/negative TypeScript checks, and the fixed-wait scanner. The runner does not repeat those three commands. They remain available individually. If that unified command or its guard files change, the runner falls back to explicit guard commands.

## Scope

- Question JSON, its canonical/copied images, question-specific mathematics tests and paired plot scripts: content path. All mathematical tests remain; only the changed questions get browser smoke. No six-suite run or full-library snapshots.
- Isolated sync, FSRS or notes-editor runtime: CI runs the mapped related browser suites.
- Shared renderers, schema/build tools, storage/persistence, service-worker logic, workflow/classifier, shared assets, deletions and unknown paths: all six suites and snapshots in CI.
- Precache manifest changes are neutral only if the service-worker code is unchanged. Generated question/image changes must be paired with identified canonical content. Uncertain scope falls back to full.

For runtime/infrastructure, preflight prints the suites **still required in CI**. It is not a full validation pass. CI owns that expensive run, so do not repeat it locally by default. To deliberately run the full audit locally:

```sh
python3 tools/validate_changes.py --full
```

## Baselines and deployment

Default local scope includes staged, unstaged and untracked files against `HEAD`. For committed branch work, pass the whole branch/push baseline, not just the most recent commit:

```sh
python3 tools/validate_changes.py --base "$(git merge-base origin/main HEAD)"
python3 tools/validate_changes.py --base <push-before-sha> --plan
```

`--plan` only inspects classification; it validates nothing. CI uses the push event's `before` SHA or the PR merge base, with full checkout history. Missing/zero baselines and manual runs use full validation. CI rejects any generated drift. The tested site artifact is uploaded once and deployed unchanged; deploy does not check out or rebuild it. PRs never publish and tests have read-only repository permissions. Superseded checks cancel. Active production deployment does not.

After green CI/deploy, check deployed changed bytes and targeted rendering without rerunning local/full suites:

```sh
python3 tools/validate_changes.py --base <push-before-sha> --live https://mintonight.github.io/control-daguan/
```

Reports/timings and targeted screenshots: `shots/validation/`. Full browser evidence: `shots/verification/`. Add/update a deterministic mathematical regression when changing a mathematical answer or plot. Scope detection is not a proof that an untested answer is correct.
