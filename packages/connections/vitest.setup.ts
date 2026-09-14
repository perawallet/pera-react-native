/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { vi } from 'vitest'

// The signing barrel transitively reaches react-native-mmkv, which has no
// loadable binding under vitest, so the whole package is unimportable here
// (`packages/walletconnect` hits the same wall). Only the ARC-60 wire module
// is needed at this layer and it is dependency-light, so it is re-exported
// for real instead of faked — a spec that needs more overrides this file with
// its own `vi.mock`.
vi.mock('@perawallet/wallet-core-signing', async () => {
    const wire = await import('../signing/src/utils/arc60-wire')
    return {
        ARC60_MAX_REQUEST_BYTES: wire.ARC60_MAX_REQUEST_BYTES,
        arc60WireSchema: wire.arc60WireSchema,
        assertArc60RequestWithinLimits: wire.assertArc60RequestWithinLimits,
        parseArc60WireRequest: wire.parseArc60WireRequest,
        // Mirror the signing package's constants.ts, which cannot be imported
        // here: it pulls the KMS barrel, and that reaches react-native-mmkv too.
        MAX_DATA_SIGN_REQUESTS: 1000,
        MAX_TRANSACTION_SIGN_REQUESTS: 1000,
    }
})

// Same wall as the signing barrel, and the same remedy: ARC-0001 is the only
// part of the blockchain package this layer touches, and it is self-contained.
vi.mock(
    '@perawallet/wallet-core-blockchain',
    async () => await import('../blockchain/src/arc0001'),
)

const store = new Map<string, string>()

vi.mock('@perawallet/wallet-extension-platform-driver', () => ({
    WithPlatformExtension: () => ({
        keyValueStorage: {
            getItem: (key: string) => store.get(key) ?? null,
            setItem: (key: string, value: string) => store.set(key, value),
            removeItem: (key: string) => {
                store.delete(key)
            },
        },
    }),
    getPlatformServices: () => ({
        keyValueStorage: {
            getItem: (key: string) => store.get(key) ?? null,
            setItem: (key: string, value: string) => store.set(key, value),
            removeItem: (key: string) => {
                store.delete(key)
            },
        },
    }),
}))
