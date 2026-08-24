/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */
// Ported from @algorandfoundation/keystore@1.0.0-canary.17 types/extension.ts
// Portions Copyright Algorand Foundation, Apache-2.0
// oxlint-disable -eslint/no-explicit-any -- ported verbatim from @algorandfoundation/keystore@1.0.0-canary.17; upstream style preserved

import type { ExtensionOptions } from '@algorandfoundation/wallet-provider'
import type { Store } from '@tanstack/store'
import type { HookCollection } from 'before-after-hook'

import type { KeyStoreAPI } from './backend'
import type { Key } from './core'

/**
 * Configuration for the keystore extension.
 */
export interface KeyStoreOptions extends ExtensionOptions {
    /** API configuration */
    api?: {
        /** The optional {@link KeyStoreAPI} backend implementation to use */
        keystore?: KeyStoreAPI
    }
    /** Keystore-specific settings */
    keystore: {
        store: Store<KeyStoreState>
        hooks: HookCollection<any>
        // Note: Other options could be available in specific contexts like ReactNative
        //vault: ReactNativeVault
    }
}

/**
 * Represents the state of the keystore extension.
 *
 * This state is intentionally UI-safe: it only contains metadata (like key IDs)
 * and status flags. It NEVER contains private key material.
 *
 * @remarks
 * Consumers can subscribe to state changes using TanStack Store selectors.
 * See {@link https://tanstack.com/store/latest docs} for details.
 */
export interface KeyStoreState {
    /** Array of available {@link KeyId}s currently stored by the backend */
    keys: Key[]
    /**
     * Current status of the keystore operation lifecycle.
     *
     * Typical values include:
     * - `"idle"` — no operation in progress
     * - `"generating"` — creating a new key/seed
     * - `"importing"` — importing an existing key
     * - `"deriving"` — deriving a key from a seed
     * - `"signing"` — signing arbitrary data
     * - `"encrypting"` / `"decrypting"` — performing crypto on payloads
     */
    status: string
}

/**
 * The interface exposed by the Keystore Extension when added to a Provider.
 */
export interface KeyStoreExtension extends KeyStoreState {
    /** The keystore backend with added support for hooks */
    key: {
        store: KeyStoreAPI & {
            /**
             * Hook collection for intercepting keystore operations.
             *
             * Supported operation ids include (non-exhaustive):
             * `"generating"`, `"importing"`, `"exporting"`, `"removing"`,
             * `"listing"`, `"getting metadata"`, `"signing"`, `"verifying"`,
             * `"encrypting"`, `"decrypting"`, `"deriving"`, `"importing seed"`,
             * `"logging audit event"`, `"getting audit logs"`, `"batch signing"`.
             *
             * Powered by {@link https://github.com/gr2m/before-after-hook before-after-hook}.
             */
            hooks: HookCollection<any>
        }
    }
}
