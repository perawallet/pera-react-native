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

import { beforeEach, describe, expect, it, vi } from 'vitest'

const KEY = new Uint8Array(32).fill(5)

// The module zeroes the key it hands over, so the mock records copies.
const mocks = vi.hoisted(() => {
    const seen: Array<Uint8Array | null> = []
    let listener: (key: Uint8Array | null) => void = () => {}
    return {
        seen,
        setKvAuthKey: vi.fn((key: Uint8Array | null) => {
            seen.push(key === null ? null : new Uint8Array(key))
        }),
        getSessionKvAuthKey: vi.fn(),
        rehydrate: vi.fn(async () => undefined),
        onKvAuthKeyChanged: vi.fn((next: (key: Uint8Array | null) => void) => {
            listener = next
            return () => {}
        }),
        emit: (key: Uint8Array | null) => listener(key),
    }
})

vi.mock('@perawallet/wallet-extension-platform-chrome', () => ({
    setKvAuthKey: mocks.setKvAuthKey,
}))
vi.mock('@perawallet/wallet-extension-vault-chrome', () => ({
    getSessionKvAuthKey: mocks.getSessionKvAuthKey,
    onKvAuthKeyChanged: mocks.onKvAuthKeyChanged,
}))
vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useNetworkStore: { persist: { rehydrate: mocks.rehydrate } },
}))

import { applySessionKvAuthKey, watchSessionKvAuthKey } from '../kvAuthKey.web'

describe('kvAuthKey.web', () => {
    beforeEach(() => {
        mocks.seen.length = 0
    })

    it('applies the session key and re-reads the network store', async () => {
        mocks.getSessionKvAuthKey.mockResolvedValue(new Uint8Array(KEY))

        await applySessionKvAuthKey()

        expect(mocks.seen).toEqual([KEY])
        expect(mocks.rehydrate).toHaveBeenCalledOnce()
    })

    it('applies no key and leaves the store alone while the vault is locked', async () => {
        mocks.getSessionKvAuthKey.mockResolvedValue(null)

        await applySessionKvAuthKey()

        expect(mocks.seen).toEqual([null])
        expect(mocks.rehydrate).not.toHaveBeenCalled()
    })

    it('sets and re-reads on unlock, and clears on lock', async () => {
        watchSessionKvAuthKey()

        mocks.emit(new Uint8Array(KEY))
        await vi.waitFor(() => expect(mocks.rehydrate).toHaveBeenCalledOnce())
        mocks.emit(null)

        expect(mocks.seen).toEqual([KEY, null])
        expect(mocks.rehydrate).toHaveBeenCalledOnce()
    })
})
