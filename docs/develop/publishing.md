## Publishing

Publishing is automated from GitHub Actions when a GitHub Release is published.

- Workflow: [.github/workflows/publish.yaml](../../.github/workflows/publish.yaml)
- Trigger: release event with type `published`
- Tag rule: release tag must start with `v` and match `package.json` version after removing the leading `v`
- Registry: npm (`https://registry.npmjs.org`)
- Package: `@htnabe/prettier-plugin-go-template`

## Release Procedure

1. Start from a release branch (for example `release/v0.0.1`).
2. Update version files without creating a tag:

```bash
npm version 0.0.1 --no-git-tag-version
```

3. Commit release changes on the release branch.
4. Create and merge PRs in this order:
   - `release/v0.0.1` -> `dev`
   - `dev` -> `main`
5. Do not push directly to `dev` or `main`. Release changes must reach both branches through PR merges.
6. After merge to `main`, verify that `main` already contains the final release workflow changes. The release tag uses the workflow files that exist on the tagged commit.
7. Create and push the release tag from `main`:

```bash
git checkout main
git pull --ff-only origin main
git tag v0.0.1
git push origin v0.0.1
```

8. Publish a GitHub Release for `v0.0.1` (event type `published`) to trigger npm publish.

```bash
gh release create v0.0.1 --verify-tag --generate-notes
```

9. Watch the publish workflow and confirm the npm release succeeds.

## Guardrails

- Do not push directly to `dev` or `main` except in an explicit emergency approved by maintainers.
- Do not delete or move release tags in normal operation. If a release fails after tagging, prefer a follow-up patch release over rewriting tag history.
- Prefer `gh release create --generate-notes` so release notes are derived from GitHub history instead of hand-maintained text.
- Before tagging, re-check `.github/workflows/publish.yaml` on `main` because GitHub Actions evaluates the workflow from the tagged commit.

## v0.0.1 Retrospective

- The publish workflow failed when `npm install -g npm@latest` resolved to a version incompatible with the pinned Node runtime.
- Releasing from a tag before the workflow fix was present on `main` required deleting and recreating the release tag, which should be treated as an exception path.
- Future releases should keep the publish workflow compatible with the pinned Node version before the tag is created.

### Dist-tags

- Stable versions publish with dist-tag `latest`
- Prerelease versions (for example `0.1.0-beta.1`) publish with dist-tag `next`
- Optional override: set repository variable `NPM_PRERELEASE_DIST_TAG`

### Required repository setup

1. Create a GitHub Environment named `publish`
2. Keep workflow permissions that enable trusted publishing (`id-token: write`, `contents: read`)
3. Ensure npm trusted publishing (OIDC) is configured for this repository/package in npm settings
