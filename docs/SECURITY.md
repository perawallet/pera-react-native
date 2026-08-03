# Security Best Practices

This is a **non-custodial wallet** — security is critical. Users trust us with their keys.

## Golden Rules

### 1. Never Log Sensitive Data

Private keys, mnemonics, and passwords must **never** appear in logs.

### 2. Use Secure Storage

Store sensitive data (keys, mnemonics) using `SecureStorageService`, which uses the device's secure keychain/keystore.

### 3. Validate All Input

Never trust user input or API responses. Validate before processing.

### 4. No Secrets in Code

Environment variables and API keys should be in `.env` files, not hardcoded.

## Sensitive Data Checklist

| Data               | Storage            | Logging |
| ------------------ | ------------------ | ------- |
| Private keys       | SecureStorage only | Never   |
| Mnemonic seeds     | SecureStorage only | Never   |
| Passwords/PINs     | SecureStorage only | Never   |
| Addresses          | Any storage        | Safe    |
| Transaction hashes | Any storage        | Safe    |

## Known limitation: changing the vault password does not rotate the key

On the browser extension, `changePassword` re-wraps the **same** 32-byte master key under a key
derived from the new password. It changes who can open the vault going forward; it does not change
what is inside it.

So it is not a remedy for a suspected compromise. An attacker who already extracted the master key,
or who holds a copy of the old `vault:wrapped-master-key` blob together with the old password, is
unaffected by a password change. The passkey (PRF) blob likewise keeps wrapping the unchanged key —
correct for continuity, but it means that path is not invalidated either.

**Rotating the master key would not fix this either, so don't build it.** Re-wrapping under a fresh
master key re-encrypts the _same plaintext_: the entries hold the actual private keys and seeds, and
those values do not change. Work the cases through and the benefit disappears —

- An attacker who read the master key out of `chrome.storage.session` also had the plaintext at that
  moment (they needed the ciphertexts to use it, and both live in the same profile). They already
  have the private keys; re-wrapping copies they've taken achieves nothing.
- An attacker holding a stale storage dump plus the old password decrypts _their_ copy with _their_
  blob. Nothing we do to ours touches theirs.
- Rotation only helps if someone holds the master key but not the ciphertexts and expects to obtain
  them later — which needs them to have read session storage but not local storage in the same
  profile. That is not a realistic split.

Key rotation is valuable when a wrapping key can leak while the data stays sealed. That does not
apply here: the master key only ever exists in memory alongside the plaintext it protects, so a
master-key compromise implies a plaintext compromise.

The only real remedy is to change the private keys — generate a new wallet and move the funds. Advise
that, not a password change and not rotation.

## Supply Chain

Review dependency updates carefully — supply chain attacks are real. The
repo has several layers of automated defense:

### Freshness window

`pnpm-workspace.yaml` sets `minimumReleaseAge: 10080` (7 days). Packages
published in the last week are refused at install time. This is our
primary defense against compromised-publish attacks, which are typically
detected and yanked within hours to days. Exceptions live under
`minimumReleaseAgeExclude` and must be justified in a comment (e.g. a
security patch that we need before the window elapses).

### Transitive-dep pins

Vulnerable transitives we can't upgrade directly are pinned under
`pnpm.overrides` in `pnpm-workspace.yaml`. Use per-major pins (`pkg@N: x.y.z`)
— range-style overrides like `pkg@>=a <b` don't actually rewrite pnpm's
resolution when the caller requests a narrower range.

### Commands

```sh
pnpm audit                            # Fails on any advisory
pnpm audit --prod --audit-level=high  # What CI runs to block PRs
```

### CI-enforced (see `.github/workflows/pre-merge.yml`)

- **`pnpm audit`** — moderate+ advisories in prod deps block merge.
- **Lockfile drift check** — `pnpm-lock.yaml` must be in sync with every
  `package.json`.
- **Gitleaks** — scans the PR diff for committed secrets. Local allowlist
  lives in [`.gitleaks.toml`](../.gitleaks.toml); add a new entry rather
  than disabling a rule globally.
- **Pinned actions** — every GitHub Action is pinned to a full commit
  SHA with a trailing version comment. Don't use floating tags
  (`@v4`, `@main`) — Dependabot handles SHA bumps.
- **Least-privilege permissions** — `contents: read` is the default;
  jobs elevate only what they need. Every `actions/checkout` uses
  `persist-credentials: false`.

### Scheduled

- **[CodeQL](../.github/workflows/codeql.yml)** — JS/TS static analysis
  weekly + on PR; findings go to the Security tab.
- **[OpenSSF Scorecard](../.github/workflows/scorecard.yml)** — weekly
  posture score, published to the public Scorecard API.
- **[SBOM](../.github/workflows/sbom.yml)** — CycloneDX SBOM generated
  on every push to `main` and weekly; 90-day artifact retention.
- **[Dependabot](../.github/dependabot.yml)** — weekly grouped updates
  for npm and github-actions. Framework-tier majors (React, React Native,
  Expo, TypeScript, ESLint) are ignored and bumped manually.

### Pre-push (`tools/pre-push`)

Gitleaks runs locally against the commits you're about to push. It
soft-skips if `gitleaks` isn't installed — `brew install gitleaks`
enables it. The authoritative scan is still the CI job.

## When in Doubt

If you're unsure whether something is secure, ask. Security mistakes are expensive.
