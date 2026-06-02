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

import type { Key, KeyStoreExtension } from '@algorandfoundation/keystore'

/** The keystore backend the in-app credential mechanism derives & signs with. */
export type LiquidAuthKeyStore = KeyStoreExtension['key']['store']

/** Platform biometric user-verification gate used by the keystore mechanism. */
export type LiquidAuthBiometrics = {
    checkBiometricsAvailable: () => Promise<boolean>
    authenticate: (options: {
        title: string
        description: string
    }) => Promise<boolean>
}

/**
 * Host services the keystore-backed credential mechanism needs from the running
 * provider. These are *injected* at bootstrap rather than imported so this
 * package never depends on `@perawallet/wallet-extension-provider`: provider
 * composes this extension (`WithLiquidAuth`), so importing it back would form a
 * build-graph cycle. The accessors are thunks, resolved lazily at ceremony time
 * (well after `initializeProvider`), so registration order is not a concern.
 */
export type LiquidAuthKeystoreHost = {
    /** Keystore backend that derives & signs P256 keys (`provider.key.store`). */
    getKeyStore: () => LiquidAuthKeyStore
    /** Current keystore key snapshot (the provider's reactive `store.state.keys`). */
    getKeys: () => Key[]
    /** Platform biometric user-verification gate (`provider.biometrics`). */
    getBiometrics: () => LiquidAuthBiometrics
}

let host: LiquidAuthKeystoreHost | null = null

/**
 * Wires the keystore host. Call once during app bootstrap, before any in-app
 * WebAuthn ceremony runs.
 */
export const setLiquidAuthKeystoreHost = (
    next: LiquidAuthKeystoreHost,
): void => {
    host = next
}

/** Resets the host. For tests only. */
export const resetLiquidAuthKeystoreHost = (): void => {
    host = null
}

export const getLiquidAuthKeystoreHost = (): LiquidAuthKeystoreHost => {
    if (!host) {
        throw new Error(
            'Liquid Auth keystore host not set. Call setLiquidAuthKeystoreHost() during bootstrap.',
        )
    }
    return host
}
