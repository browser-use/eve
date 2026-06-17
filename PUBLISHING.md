# Publishing `@browser-use/eve`

Local prep is done (git, license, metadata, build verified). The steps below are
the **outward, gated actions** — run them when ready.

## 0. Confirm

- [ ] Repo name under the org (this scaffold assumes `browser-use/browser-use-eve` —
      change `repository`/`homepage`/`bugs` in `package.json` if you pick another).
- [ ] You have publish rights to the **@browser-use** npm scope.

## 1. Create the org repo and push

```bash
# from this directory
gh repo create browser-use/browser-use-eve --public --source=. --remote=origin --push
```

## 2. Publish to npm

```bash
npm login                       # if not already
npm publish                     # publishConfig.access is already "public"
                                # prepublishOnly runs the build automatically
```

For provenance (recommended, from CI or a clean checkout):

```bash
npm publish --provenance
```

## 3. After publish

- [ ] Verify install in a fresh eve app: `npm i @browser-use/eve && npx browser-use-eve add`
- [ ] Tag the release: `git tag v0.0.1 && git push --tags`
- [ ] Open the eve Integrations gallery PR (coordinate with Vercel).
- [ ] Cross-link from Browser Use docs.

## Notes

- The published tarball contains only `dist/` (+ `README`, `LICENSE`, `package.json`)
  per the `files` field — verify with `npm pack --dry-run`.
- `peerDependencies` (`eve`, `zod`) are provided by the consuming eve app.
- `browser-use-sdk` is a real dependency and installs with the package.
