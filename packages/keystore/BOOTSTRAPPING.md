# Keystore Bootstrapping Guide

## Overview

The `@algorandfoundation/react-native-keystore` package provides a secure, persistent, and concrete keystore implementation for React Native applications. It integrates directly with the Algorand Wallet Provider and handles secure storage using MMKV (for encrypted key material) and Keychain (for the master encryption key).

## Core Principle: Separation of Concerns

The keystore follows a **clear separation** between UI state, encrypted storage, and encryption keys:

- **TanStack Store** → UI state (metadata, loading states, available keys).
- **MMKV** → Encrypted cryptographic keys and seeds (AES-256-GCM).
- **Keychain** → Master encryption key (Hardware-backed).

This ensures your raw private keys are never stored in React state or plain persistent storage.

## Quick Start Integration

### 1. Configure the Store

Create a TanStack store for the keystore to manage its reactive state.

```typescript
// stores/keystore.ts
import { Store } from '@tanstack/store'
import { KeyStoreState } from '@algorandfoundation/keystore'

export const keyStore = new Store<KeyStoreState>({
    keys: [],
    status: 'idle',
})
```

### 2. Initialize the Provider

In your main application file (e.g., `_layout.tsx` or `App.tsx`), initialize the `ReactNativeProvider` with the `WithKeyStore` extension and set up the React Context.

```typescript
// providers/ReactNativeProvider.tsx
import React, { createContext, type ReactNode } from 'react';
import { Provider } from '@algorandfoundation/wallet-provider';
import { WithKeyStore } from "@algorandfoundation/react-native-keystore";
import { KeyStoreAPI, Key } from "@algorandfoundation/keystore";
import { keyStore } from "@/stores/keystore";

export class ReactNativeProvider extends Provider<typeof ReactNativeProvider.EXTENSIONS> {
    static EXTENSIONS = [
        WithKeyStore,
        // other extensions like WithLogStore
    ] as const

    keys!: Key[]
    status!: string
    keystore!: KeyStoreAPI
}

// Create the Context
export const AlgorandContext = createContext<null | ReactNativeProvider>(null);

// Create the Provider Component
export function AlgorandProvider({ children, provider }: { children: ReactNode, provider: ReactNativeProvider }) {
    return (
        <AlgorandContext.Provider value={provider}>
            {children}
        </AlgorandContext.Provider>
    )
}
```

### 3. Create the useProvider Hook

Use a custom hook to access the provider and its reactive state within your UI components.

```typescript
// hooks/useProvider.ts
import { useContext } from 'react'
import { useStore } from '@tanstack/react-store'
import { AlgorandContext } from '@/providers/ReactNativeProvider'
import { keyStore } from '@/stores/keystore'

export function useProvider() {
    const provider = useContext(AlgorandContext)
    if (provider === null) throw new Error('No Provider Found')

    // Hydrate the store in the context (React)
    const keys = useStore(keyStore, state => state.keys)
    const status = useStore(keyStore, state => state.status)

    return { ...provider, keys, status }
}
```

### 4. Bootstrap the Keystore

During app startup, you must load the stored keys from persistent storage into the reactive store.

```typescript
// app/_layout.tsx
import { keyStore } from "@/stores/keystore";
import {
  fetchSecret,
  getMasterKey,
  storage
} from "@algorandfoundation/react-native-keystore";
import {
  initializeKeyStore,
  Key,
  KeyData,
  KeyStoreState,
  setStatus
} from "@algorandfoundation/keystore";
import { AlgorandProvider, ReactNativeProvider } from "@/providers/ReactNativeProvider";

async function bootstrap() {
  setStatus({ store: keyStore as any, status: "loading" });

  // 1. Get the master encryption key from Keychain
  const masterKey = await getMasterKey();

  // 2. Get all key IDs from MMKV storage
  const keyIds = storage.getAllKeys();

  // 3. Fetch and decrypt each key from MMKV using the master key
  const secrets = await Promise.all(
    keyIds.map(async (keyId) =>
      fetchSecret<KeyData>({
        keyId,
        masterKey
      })
    )
  );

  // 4. Initialize the reactive store (excluding private keys for security)
  initializeKeyStore({
    store: keyStore as any,
    keys: secrets
      .filter((s) => s !== null)
      .map(({ privateKey, ...rest }) => rest) as Key[]
  });

  setStatus({ store: keyStore as any, status: "idle" });
}

bootstrap();

export default function RootLayout() {
  const provider = new ReactNativeProvider({
    id: 'my-app',
    name: 'My Application',
  }, {
    keystore: {
      extension: { store: keyStore }
    }
  });

  return (
    <AlgorandProvider provider={provider}>
      {/* Your application components */}
    </AlgorandProvider>
  );
}
```

### 5. Use in the UI

Once bootstrapped, use the `useProvider` hook to access the keystore.

```typescript
// components/MyWallet.tsx
import { useProvider } from "@/hooks/useProvider";

export function MyWallet() {
  const { keystore, keys, status } = useProvider();

  const handleGenerate = async () => {
    const keyId = await keystore.generate({
      type: "hd-derived-ed25519",
      algorithm: "EdDSA",
      extractable: false,
      params: {
        parentKeyId: seedId,
        account: 0,
        index: 0
      }
    });
    console.log("Generated Key:", keyId);
  };

  return (
    <View>
      <Text>Status: {status}</Text>
      <Button title="Generate Key" onPress={handleGenerate} />
      {keys.map(key => (
        <Text key={key.id}>{key.id}</Text>
      ))}
    </View>
  );
}
```

## Security Best Practices

1.  **Never store private keys in the TanStack store**: Always filter them out during initialization.
2.  **Use `getMasterKey()`**: Ensure your encryption/decryption uses the master key stored in the secure Keychain.
3.  **Automatic Cleanup**: The `sign`, `derive`, and `generate` methods automatically fetch private keys and clear them from memory after use.
4.  **MMKV vs Keychain**: Use MMKV for high-performance encrypted storage of key material, and Keychain for the root master key.
