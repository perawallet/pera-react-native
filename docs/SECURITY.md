# Security Best Practices

Security is paramount in a non-custodial wallet application.

## Sensitive Data

- **Private Keys / Mnemonic Seeds**:
    - **NEVER** store these in plain text (Redux state, AsyncStorage, Files).
    - **ALWAYS** use the `SecureStorageService` (wraps Keychain/Keystore) via the `platform-integration` package.
    - Keep them in memory for as short a time as possible.

- **Logging**:
    - **NEVER** log Private Keys, Mnemonics, or full payloads containing them.
    - Use our custom `Logger` which supports `LogContext`.
    - Ensure any object passed to the logger is sanitized (e.g., replace sensitive fields with `[REDACTED]`).

## Environment Variables

- **Credentials**: Do not commit distinct API keys or secrets to the repo.
- **Config**: Use `.env` files for configuration.
- **Exposure**: Be aware that anything in the mobile app bundle is public.

## Input Validation

- **User Input**: Validate all user input (Addresses, Amounts) before processing.
- **API Responses**: Do not implicitly trust API responses. Ideally validate schemas using Zod (generated clients do this).

## Dependency Safety

- **Audits**: Regularly run `pnpm audit`.
- **Pinning**: We lock dependencies to ensure reproducible and reviewed builds. Be very careful when updating dependencies to avoid supply chain attacks.
