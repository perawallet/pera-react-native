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

const kvStore = new Map<string, string>()

vi.mock('@perawallet/wallet-extension-platform-driver', () => ({
    WithPlatformExtension: () => ({
        keyValueStorage: {
            getItem: (key: string) => kvStore.get(key) ?? null,
            setItem: (key: string, value: string) => kvStore.set(key, value),
            removeItem: (key: string) => {
                kvStore.delete(key)
            },
        },
    }),
    getPlatformServices: () => ({
        keyValueStorage: {
            getItem: (key: string) => kvStore.get(key) ?? null,
            setItem: (key: string, value: string) => kvStore.set(key, value),
            removeItem: (key: string) => {
                kvStore.delete(key)
            },
        },
    }),
}))

vi.mock('@perawallet/wallet-extension-provider', () => {
    const provider = {
        keyValueStorage: {
            getItem: (key: string) => kvStore.get(key) ?? null,
            setItem: (key: string, value: string) => kvStore.set(key, value),
            removeItem: (key: string) => {
                kvStore.delete(key)
            },
        },
        deviceInfo: { getDevicePlatform: () => 'ios' },
    }
    return {
        getProvider: () => provider,
        keystoreSubtle: globalThis.crypto.subtle,
    }
})

vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared')
    >('@perawallet/wallet-core-shared')
    return {
        ...actual,
        logger: {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
        generateOrderedUniqueId: vi.fn(() => 'mock-time-uuid'),
    }
})
