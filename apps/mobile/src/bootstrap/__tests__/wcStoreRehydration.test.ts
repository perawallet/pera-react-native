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

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { onLocalStorageKeyChanged, rehydrate, unsubscribe } = vi.hoisted(() => ({
    onLocalStorageKeyChanged: vi.fn(),
    rehydrate: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn(),
}))

vi.mock('@perawallet/wallet-extension-platform-chrome', () => ({
    onLocalStorageKeyChanged,
}))

vi.mock('@perawallet/wallet-core-walletconnect', () => ({
    useWalletConnectStore: { persist: { rehydrate } },
}))

describe('registerWcStoreRehydration', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        onLocalStorageKeyChanged.mockReturnValue(unsubscribe)
    })

    it("subscribes under the WC store's real kv: persisted key", async () => {
        const { registerWcStoreRehydration } =
            await import('../wcStoreRehydration.web')

        registerWcStoreRehydration()

        expect(onLocalStorageKeyChanged).toHaveBeenCalledWith(
            ['kv:wallet-connect-store'],
            expect.any(Function),
        )
    })

    it('rehydrates the WC store when its key changes', async () => {
        const { registerWcStoreRehydration } =
            await import('../wcStoreRehydration.web')

        registerWcStoreRehydration()
        const listener = onLocalStorageKeyChanged.mock.calls[0]?.[1] as (
            key: string,
        ) => void
        listener('kv:wallet-connect-store')

        expect(rehydrate).toHaveBeenCalledTimes(1)
    })

    it('returns the underlying unsubscribe function', async () => {
        const { registerWcStoreRehydration } =
            await import('../wcStoreRehydration.web')

        const result = registerWcStoreRehydration()

        expect(result).toBe(unsubscribe)
    })
})
