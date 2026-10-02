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

import { beforeEach, vi } from 'vitest'
import { registerFakeBroadcaster } from './src/__tests__/fakeBroadcaster'
import { registerFakeLocalKeySignerAdapter } from './src/__tests__/fakeLocalKeySignerAdapter'
import { registerFakeMessageSignerAdapter } from './src/__tests__/fakeMessageSignerAdapter'
import { registerFakePlannerAdapter } from './src/__tests__/fakePlannerAdapter'
import { registerFakeReviewerAdapter } from './src/__tests__/fakeReviewerAdapter'

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

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        keyValueStorage: {
            getItem: (key: string) => store.get(key) ?? null,
            setItem: (key: string, value: string) => store.set(key, value),
            removeItem: (key: string) => {
                store.delete(key)
            },
        },
    }),
}))

// The machine and hooks resolve the chain through the adapter registries.
beforeEach(() => {
    registerFakeBroadcaster()
    registerFakeReviewerAdapter()
    registerFakePlannerAdapter()
    registerFakeLocalKeySignerAdapter()
    registerFakeMessageSignerAdapter()
})
