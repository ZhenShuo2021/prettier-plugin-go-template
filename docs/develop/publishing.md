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
5. After merge to `main`, create and push the release tag:

```bash
git checkout main
git pull
git tag v0.0.1
git push
git push --tags
```

6. Publish a GitHub Release for `v0.0.1` (event type `published`) to trigger npm publish.

### Dist-tags

- Stable versions publish with dist-tag `latest`
- Prerelease versions (for example `0.1.0-beta.1`) publish with dist-tag `next`
- Optional override: set repository variable `NPM_PRERELEASE_DIST_TAG`

### Required repository setup

1. Create a GitHub Environment named `publish`
2. Keep workflow permissions that enable trusted publishing (`id-token: write`, `contents: read`)
3. Ensure npm trusted publishing (OIDC) is configured for this repository/package in npm settings
