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

## Dependency Safety

```sh
pnpm audit              # Check for vulnerabilities
```

Review dependency updates carefully. Supply chain attacks are real.

## When in Doubt

If you're unsure whether something is secure, ask. Security mistakes are expensive.
