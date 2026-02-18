# @perawallet/react-native-keystore

> [!CAUTION]
> This package is vendored from the [Algorand Foundation](https://github.com/algorandfoundation/wallet-provider-extensions/keystore/react-native).
> it will eventually move upstream when it becomes stable

A secure key management system for the Algorand Wallet Provider. Manage cryptographic keys, derive HD wallets from BIP39 seeds, and sign arbitrary data—all while keeping private keys locked away in a secure vault.

## Why This Exists

Building a non-custodial wallet requires a **secure, isolated key vault**. The Keystore Extension separates key management from wallet logic:

- **Users** import their BIP39 mnemonic once
- **Wallet UI** requests signatures without ever seeing the seed or private keys
- **Keystore backend** handles all cryptographic operations securely
- **Keys are cleared from memory** immediately after use, never staying in memory
- **Every operation is audited** for compliance and security forensics

This architecture enables:

- ✅ Non-custodial key management (users control keys)
- ✅ Multi-account support from a single seed (Algorand's `m/44'/283'/account'/change/index`)
- ✅ Ed25519 signing for Algorand

## Quick Start

### 1. Initialize the Keystore

The keystore is typically used as an extension for the Algorand Wallet Provider.

```typescript
import { WithKeyStore } from '@algorandfoundation/react-native-keystore'
import { Provider } from '@algorandfoundation/wallet-provider'
import { keyStore } from './stores/keystore'
import { keyStoreHooks } from './stores/hooks'

// Use the concrete provider pattern
class MyProvider extends Provider<typeof MyProvider.EXTENSIONS> {
    static EXTENSIONS = [WithKeyStore] as const
}

const provider = new MyProvider(
    {
        id: 'my-app',
        name: 'My Application',
    },
    {
        keystore: {
            extension: {
                store: keyStore,
                hooks: keyStoreHooks,
            },
        },
    },
)
```

### 2. Generate a Key

```typescript
const keyId = await provider.keystore.generate({
    type: 'hd-derived-ed25519',
    algorithm: 'EdDSA',
    extractable: false,
    keyUsages: ['sign'],
    params: {
        parentKeyId: seedId,
        account: 0,
        index: 0,
    },
})

console.log(keyId) // "abc-123..."
```

### 3. Sign Arbitrary Data

```typescript
const data = new Uint8Array([1, 2, 3, ...]);

const signature = await provider.keystore.sign(keyId, data);
// Private key never exposed — signature is returned directly
```

### 4. Import a BIP39 Mnemonic

```typescript
// User provides their 25-word seed phrase
const mnemonic = 'abandon abandon abandon ... about'

const seedId = await provider.keystore.importSeed(mnemonic)
// Seed is securely stored; never exposed to the wallet UI
```

### 5. Derive Multiple Accounts

```typescript
// Derive account 0
const account0 = await provider.keystore.deriveFromSeed(
    seedId,
    "m/44'/283'/0'/0/0", // Algorand path
)

// Derive account 1
const account1 = await provider.keystore.deriveFromSeed(
    seedId,
    "m/44'/283'/0'/0/1",
)

// Sign with any account — keys are isolated
const sig0 = await provider.keystore.sign(account0, data)
const sig1 = await provider.keystore.sign(account1, data)
```

## API Overview

### Core Operations

```typescript
// Generate a new key
const keyId = await provider.keystore.generate(options)

// Import a key or seed
const keyId = await provider.keystore.import(keyData, format)
const seedId = await provider.keystore.importSeed(seed)

// Export public key (private key never exported)
const keyData = await provider.keystore.export(keyId)

// Sign and verify
const signature = await provider.keystore.sign(keyId, data)
const isValid = await provider.keystore.verify(keyId, data, signature)

// HD Wallet derivation
const derivedKeyId = await provider.keystore.deriveFromSeed(
    seedId,
    "m/44'/283'/0'/0/0",
)

// List and manage keys
const allKeys = provider.keys
const status = provider.status
await provider.keystore.remove(keyId)
await provider.keystore.clear()
```

## Security Properties

### Private Keys

- ✅ **Never exported** from the keystore
- ✅ **Never exposed** to the wallet UI or React state
- ✅ **Always encrypted** at rest (Stored in MMKV, encrypted with Keychain-backed master key)
- ✅ **Ephemeral in memory** — cleared immediately after use via `clearBuffer`
- ✅ **Isolated** per derivation path (multi-account support)

### Seeds (BIP39)

- ✅ **Never exported** after import
- ✅ **Never shared** with wallet UI
- ✅ **Derivation happens inside** the secure backend
- ✅ **Ephemeral in memory** — seeds are cleared after derivation
- ✅ **Child keys are isolated** — deriving Account 0 doesn't expose the seed

## Architecture & Bootstrapping

For more detailed information, see:

- [ARCHITECTURE.md](./ARCHITECTURE.md) — Design details and storage flow.
- [BOOTSTRAPPING.md](./BOOTSTRAPPING.md) — Complete integration and startup guide.

## License

Apache-2.0
