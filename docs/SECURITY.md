# Security Best Practices

Security is paramount in a non-custodial wallet application. This document outlines security practices that must be followed.

## Sensitive Data Handling

### Private Keys & Mnemonic Seeds

**NEVER** store these in plain text:

```typescript
// ❌ NEVER DO THIS
const privateKey = 'abc123...'
AsyncStorage.setItem('privateKey', privateKey)
localStorage.setItem('mnemonic', mnemonic)

// ✅ ALWAYS use secure storage
import { useSecureStorageService } from '@perawallet/wallet-core-platform-integration'

const secureStorage = useSecureStorageService()
await secureStorage.setItem('privateKey', encryptedKey)
```

**Rules:**

- **ALWAYS** use the `SecureStorageService` (wraps Keychain/Keystore) via the `platform-integration` package
- Keep keys in memory for as short a time as possible
- Clear sensitive data from memory when no longer needed
- Never pass keys through state management stores

### Logging

**NEVER** log sensitive data:

```typescript
// ❌ NEVER DO THIS
console.log('Private key:', privateKey)
console.log('Mnemonic:', mnemonic)
logger.info('Transaction data:', { privateKey, amount })

// ✅ Use structured logging with sanitization
import { logger } from '@perawallet/wallet-core-shared'

logger.info('Transaction initiated', {
    from: address,
    amount: amount,
    // Never include privateKey, mnemonic, etc.
})
```

**Rules:**

- Use our custom `Logger` which supports `LogContext`
- Sanitize any object passed to the logger
- Replace sensitive fields with `[REDACTED]`
- In production, ensure debug logs are disabled

### Sensitive Data Checklist

| Data Type          | Storage            | Transit        | Logging     |
| ------------------ | ------------------ | -------------- | ----------- |
| Private Keys       | SecureStorage only | Never transmit | Never log   |
| Mnemonic Seeds     | SecureStorage only | Never transmit | Never log   |
| Passwords/PINs     | SecureStorage only | Never transmit | Never log   |
| Addresses          | Any storage        | Can transmit   | Safe to log |
| Transaction Hashes | Any storage        | Can transmit   | Safe to log |

---

## Environment Variables

### Client-Side Exposure

Be aware that **anything in the mobile app bundle is PUBLIC**:

```typescript
// These are visible to anyone who decompiles the app
process.env.EXPO_PUBLIC_API_URL // Public API URL - OK
process.env.EXPO_PUBLIC_API_KEY // API key - VISIBLE TO PUBLIC!
```

**Rules:**

- Do not commit distinct API keys (beyond defaults) to the repo
- Use `.env` files for configuration (add to `.gitignore`)
- Treat all client-side env vars as public
- Never put secrets in the mobile app bundle

### Environment Configuration

```sh
# .env.example (safe to commit)
EXPO_PUBLIC_GRAPHQL_API_URL=https://api.example.com
EXPO_PUBLIC_ENV=development

# .env.local (NEVER commit)
EXPO_PUBLIC_GRAPHQL_API_URL=https://prod-api.example.com
SECRET_BUILD_KEY=xyz123  # Build-time only
```

---

## Input Validation

### User Input

Validate all user input before processing:

```typescript
// ❌ BAD: No validation
const sendTransaction = (address: string, amount: number) => {
    api.send(address, amount)
}

// ✅ GOOD: Validate first
import { z } from 'zod'

const TransactionSchema = z.object({
    address: z.string().regex(/^[A-Z2-7]{58}$/), // Algorand address format
    amount: z.number().positive().max(MAX_ALGO),
})

const sendTransaction = (input: unknown) => {
    const result = TransactionSchema.safeParse(input)
    if (!result.success) {
        throw new ValidationError('Invalid transaction data')
    }
    api.send(result.data.address, result.data.amount)
}
```

### API Responses

Do not implicitly trust API responses:

```typescript
// ❌ BAD: Trusting API response
const data = await fetch('/api/account')
const balance = data.balance // Could be anything!

// ✅ GOOD: Validate with schema
import { AccountResponseSchema } from './schemas'

const response = await fetch('/api/account')
const data = await response.json()
const result = AccountResponseSchema.safeParse(data)

if (!result.success) {
    throw new ApiValidationError('Invalid account response')
}

const balance = result.data.balance
```

---

## Dependency Safety

### Audits

Regularly run security audits:

```sh
pnpm audit              # Check for vulnerabilities
pnpm audit --fix        # Auto-fix where possible
```

### Dependency Pinning

We lock dependencies to ensure reproducible and reviewed builds:

- Use `pnpm-lock.yaml` to lock exact versions
- Review dependency updates carefully
- Be cautious with transitive dependencies
- Watch for supply chain attacks

### Update Process

When updating dependencies:

1. Check the changelog for breaking changes
2. Review the diff for suspicious code
3. Run full test suite
4. Test on both platforms
5. Monitor error rates after merge

---

## Code Security Patterns

### Avoid Eval and Dynamic Code

```typescript
// ❌ NEVER DO THIS
eval(userInput)
new Function(userInput)
```

### Use Constant-Time Comparisons for Secrets

```typescript
// ❌ BAD: Timing attack vulnerable
if (userToken === secretToken) {
}

// ✅ GOOD: Use crypto.timingSafeEqual
import { timingSafeEqual } from 'crypto'
if (timingSafeEqual(Buffer.from(userToken), Buffer.from(secretToken))) {
}
```

### Handle Errors Securely

```typescript
// ❌ BAD: Leaking internal details
catch (error) {
    res.status(500).json({ error: error.stack })
}

// ✅ GOOD: Generic error to user, detailed logs
catch (error) {
    logger.error('Internal error', { error })
    throw new UserFacingError('Something went wrong')
}
```

---

## Security Review Checklist

Before submitting changes:

- [ ] No sensitive data logged or stored insecurely
- [ ] All user inputs validated
- [ ] API responses validated with schemas
- [ ] No hardcoded secrets in code
- [ ] Dependencies audited and pinned
- [ ] Error messages don't leak internal details
- [ ] Sensitive operations use secure storage

---

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do not** open a public issue
2. Contact the security team privately
3. Provide detailed reproduction steps
4. Allow time for a fix before disclosure
