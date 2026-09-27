# Pending CI workflow

`ci.yml` here is the GitHub Actions workflow for this repo. It is **not** at
`.github/workflows/ci.yml` in git yet because the token used for the first push lacked the
`workflow` OAuth scope, and GitHub refuses to accept a workflow file without it:

```
! [remote rejected] main -> main (refusing to allow an OAuth App to create or update
  workflow `.github/workflows/ci.yml` without `workflow` scope)
```

## Enabling it

```bash
gh auth refresh -h github.com -u eliesaide123 -s workflow   # opens a browser, one time
git mv .github/workflows-pending/ci.yml .github/workflows/ci.yml
git rm .github/workflows-pending/README.md
git commit -m "ci: enable GitHub Actions workflow"
git push
```

(Or just paste the file into the repo through the GitHub web UI, which is not subject to the
OAuth scope restriction.)

## What it does

Three jobs on push/PR to `main`:

- **backend** — spins up a `mongo:7` service, `npm ci`, seeds the database, boots the server and
  asserts `GET /api/health` reports `status: ok`
- **cms** — `npm ci` and `npm run build`
- **mobile** — `npm ci`, `npx tsc --noEmit`, `npx eslint .`

It does not yet run `tests/` (the integration suites need a live backend *and* a seeded database in
the same job); wiring them into the backend job is the obvious next step.
