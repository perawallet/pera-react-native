# Keystore Architecture Migration

## Overview

Pera Wallet has transitioned from a **monolithic, Pera-specific KMS** to a **standardized, composable Provider pattern** built on Algorand Foundation libraries. This document explains the architectural shift, its implications, and the value it delivers.

## The Old Architecture

### KMS Package (`packages/kms`)

```
┌─────────────────────────────────────────────┐
│  apps/mobile                                 │
│    ↓                                         │
│  packages/kms (Zustand store)               │
│    - Keys in React state                    │
│    - Custom crypto implementation           │
│    - App-managed storage                    │
└─────────────────────────────────────────────┘
```

**Characteristics:**

- Keys persisted in Zustand store (accessible in React DevTools)
- Application-managed encryption
- Tightly coupled to Pera's internal patterns
- Limited extensibility

## The New Architecture

### Provider + Extension Pattern

```
┌─────────────────────────────────────────────┐
│  apps/mobile                                 │
│    ↓                                         │
│  AlgorandProvider (@wallet-provider)         │
│    ├─ WithKeyStore extension                │
│    └─ [Future extensions...]                │
│         ↓                                    │
│    @react-native-keystore                    │
│      ├─ MMKV (encrypted key storage)        │
│      ├─ Keychain (hardware master key)      │
│      └─ TanStack Store (reactive metadata)  │
└─────────────────────────────────────────────┘
```

**Key Components:**

1. **Wallet Provider** - Generic foundation standard, not Pera-specific
2. **WithKeyStore Extension** - Secure key management as a pluggable extension
3. **React Native Keystore** - Concrete implementation using platform-native security

## Security Improvements

| Aspect                   | Before (KMS)                | After (Keystore)                    |
| ------------------------ | --------------------------- | ----------------------------------- |
| **Key Storage**          | Zustand store (React state) | MMKV (encrypted, AES-256-GCM)       |
| **Master Key**           | Application-managed         | Keychain/Keystore (hardware-backed) |
| **Memory Safety**        | Keys persisted in state     | Ephemeral—cleared after use         |
| **Private Key Exposure** | Visible in Redux DevTools   | Never in React state                |
| **Encryption**           | Custom implementation       | Platform-native AES-GCM             |

### Security Properties

**Private Keys:**

- Never exported from the keystore
- Never exposed to wallet UI or React state
- Always encrypted at rest (MMKV + Keychain)
- Isolated per derivation path (multi-account support)

**Seeds (BIP39):**

- Never exported after import
- Derivation happens inside the secure storage layer
- Child keys are isolated—deriving Account 0 doesn't expose the seed

## Value Proposition

### 1. Standardization

Adopts `@algorandfoundation/wallet-provider`—an ecosystem standard that enables:

- Seamless dApp integration
- Compatibility with WalletConnect
- Future browser extension support
- Alignment with audited, community-maintained libraries

### 2. Composability

Extensions allow features to be added cleanly:

```typescript
class AlgorandProvider extends Provider {
    static EXTENSIONS = [
        WithKeyStore, // Key management
        WithLogStore, // Future: transaction logging
        WithPasskeys, // Future: WebAuthn support
        // ...
    ]
}
```

### 3. Platform-Optimized Security

```
┌─────────────────┐
│  Secure Enclave │  ← Master key (iOS Keychain / Android Keystore)
│  (Hardware)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  AES-256-GCM    │  ← Encryption layer
│  (Software)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  MMKV Storage   │  ← Encrypted key material
│  (File System)  │
└─────────────────┘
```

**Benefits:**

- Hardware-backed master key = brute-force resistance
- AES-256-GCM = industry-standard authenticated encryption
- MMKV = high-performance, persistent storage
- Automatic memory clearing = protection from memory dumps

### 4. Separation of Concerns

| Layer              | Responsibility                          |
| ------------------ | --------------------------------------- |
| **TanStack Store** | Reactive UI state (metadata only)       |
| **MMKV**           | Encrypted cryptographic keys and seeds  |
| **Keychain**       | Master encryption key (hardware-backed) |

Raw private keys are never stored in React state or plain persistent storage.

### 5. Future-Proofing

The foundation libraries provide:

- BIP32-Ed25519 HD wallet support (XHD)
- P-256 derivation for Passkeys (DP256)
- Standardized interfaces for future crypto algorithms
- Clear migration path for new platforms (browser extensions, desktop apps)

## Migration Status

**Current State:**

- `packages/keystore` - New implementation (local fork)
- `packages/kms` - Legacy implementation (still present)

**Note:** The keystore is currently a **local fork** (`@perawallet/react-native-keystore`) while we validate the integration. Long-term, we expect to align with `@algorandfoundation/react-native-keystore` for community maintenance and auditability.

## Bootstrapping Flow

When the app starts, the keystore performs a secure bootstrap:

1. **Retrieve master key** from Keychain (hardware-backed)
2. **Read encrypted keys** from MMKV storage
3. **Decrypt** key metadata using the master key
4. **Initialize reactive store** with public metadata (private keys stay encrypted)
5. **Ephemeral access** - Private keys decrypted only when needed, cleared immediately after

```typescript
// Example: Secure key access
async function signTransaction(keyId: string, data: Uint8Array) {
    // 1. Fetch encrypted key from MMKV
    // 2. Decrypt using master key from Keychain
    // 3. Sign transaction
    // 4. Clear private key from memory immediately
}
```

## References

- [`packages/keystore/ARCHITECTURE.md`](../../packages/keystore/ARCHITECTURE.md) - Detailed architecture
- [`packages/keystore/BOOTSTRAPPING.md`](../../packages/keystore/BOOTSTRAPPING.md) - Integration guide
- [`apps/mobile/src/providers/ReactNativeProvider.tsx`](../../apps/mobile/src/providers/ReactNativeProvider.tsx) - Provider implementation
- [Algorand Foundation Wallet Provider](https://github.com/algorandfoundation/wallet-provider) - Foundation library
