# Security

This is a non-custodial wallet. Users trust us with keys we cannot recover for them.

## Reporting a vulnerability

A flaw that exposes key material, forges a signature, or makes a transaction display as something
other than what it does has no remedy after the fact. Report it privately to
**security@perawallet.app** rather than opening an issue, pull request or discussion, and please don't
publish it before a fix ships.

Send whatever you have: affected version and platform, the steps or payload that reproduce it, and
what an attacker gains. A rough report early beats a polished one late.

In scope is anything that reaches key material, produces a signature the user did not authorise, or
makes a transaction render as something other than what it will do on chain — the mobile app in
`apps/mobile`, the extension vault in `extensions/keystore-chrome`, the hardware-wallet and passkey
transports under `extensions/`, and the shared logic in `packages/`. A build or dependency path that
could get unreviewed code into a released binary counts too.

Out of scope: findings that need a device the attacker already controls (rooted or jailbroken, screen
unlocked), that need the user to hand over their own passphrase, or that rest on a compromised
third-party service we call. Scanner output without a working reproduction is rarely actionable on
its own.

We triage privately, fix on a private branch, and publish an advisory once a release carrying the fix
is out. Say whether you want credit and how you would like to be named.

## Non-negotiables

Private keys, mnemonics and passwords never appear in a log, a crash report, an analytics event or
an error message. Addresses and transaction hashes are safe to log.

Key material lives in the keystore and nowhere else: `@algorandfoundation/react-native-keystore` on
native; on the browser extension, `@algorandfoundation/keystore-web`'s IndexedDB store, with every
record sealed under the master key that the `extensions/keystore-chrome` vault releases only while
unlocked. It never goes into `keyValueStorage`, a Zustand store, or React state that outlives the
operation.

Validate user input and API responses before acting on them. Keep secrets in `.env`, not in source.

## Known limitation: changing the vault password does not rotate the key

On the browser extension, `changePassword` re-wraps the same 32-byte master key under a key derived
from the new password. That master key is also the key every keystore record is sealed under, so a
password change changes who can open the vault going forward and nothing about what is inside it.

An attacker holding a copy of the old `vault:wrapped-master-key` blob together with the old password
decrypts _their_ copy with _their_ blob, and any later copy of the profile's IndexedDB opens under the
same master key. A password change is therefore not a remedy for a leaked password. The passkey (PRF)
blob likewise keeps wrapping the unchanged key.

Rotation — a fresh master key, every record re-sealed under it, both blobs re-wrapped — would close
that case. It is not built. Until it is, the remedy for a leaked password is to move the funds to a
new wallet.

What the vault defends: a cold attacker holding a copy of the browser profile and no password (an
infostealer, a backup, a shared machine). Only Argon2id's cost stands between them and the material.
What it does not defend: a script running in the extension's own origin while the vault is unlocked
— a compromised dependency, XSS in an approval page, an open devtools session — which can read the
session key from `chrome.storage.session` and use it directly.

## Supply chain

Review dependency updates carefully. Several layers of automated defence back that up.

### Freshness window

`pnpm-workspace.yaml` sets `minimumReleaseAge: 10080` (7 days), so packages published in the last
week are refused at install time. This is the primary defence against compromised-publish attacks,
which are typically detected and yanked within hours to days. Exceptions live under
`minimumReleaseAgeExclude` and must be justified in a comment, for example a security patch needed
before the window elapses.

### Transitive-dep pins

Vulnerable transitives we can't upgrade directly are pinned under `pnpm.overrides` in
`pnpm-workspace.yaml`. Use per-major pins (`pkg@N: x.y.z`). Range-style overrides like
`pkg@>=a <b` don't actually rewrite pnpm's resolution when the caller requests a narrower range.

```sh
pnpm audit                            # Fails on any advisory
pnpm audit --prod --audit-level=high  # What CI runs to block PRs
```

### CI-enforced

See `.github/workflows/ci-pre-merge.yml`.

- `pnpm audit`: moderate+ advisories in prod deps block merge.
- Lockfile drift: `pnpm-lock.yaml` must be in sync with every `package.json`.
- Gitleaks scans the PR diff for committed secrets. The local allowlist lives in
  [`.gitleaks.toml`](../.gitleaks.toml); add an entry rather than disabling a rule globally.
- Every GitHub Action is pinned to a full commit SHA with a trailing version comment. No floating
  tags (`@v4`, `@main`); Dependabot handles SHA bumps.
- `contents: read` is the default permission and jobs elevate only what they need. Every
  `actions/checkout` uses `persist-credentials: false`.

### Scheduled

- [CodeQL](../.github/workflows/security-codeql.yml) runs JS/TS static analysis weekly and on PR; findings go
  to the Security tab.
- [OpenSSF Scorecard](../.github/workflows/security-scorecard.yml) publishes a weekly posture score to the
  public Scorecard API.
- [SBOM](../.github/workflows/security-sbom.yml) generates a CycloneDX SBOM on every push to `main` and
  weekly, retained 90 days.
- [Dependabot](../.github/dependabot.yml) opens weekly grouped updates for npm and github-actions.
  Framework-tier majors (React, React Native, Expo, TypeScript, ESLint) are ignored and bumped by
  hand.

### Pre-push

`tools/pre-push` runs gitleaks locally against the commits you're about to push. It soft-skips if
`gitleaks` isn't installed (`brew install gitleaks` enables it). The CI job is still the
authoritative scan.
