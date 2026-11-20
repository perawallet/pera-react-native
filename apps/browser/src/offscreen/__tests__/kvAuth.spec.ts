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
import type { OffscreenLockState } from '@perawallet/wallet-core-browser-runtime'

// The module zeroes the key it hands over, so the mock records copies.
const { requestKvAuthKey, seen, setKvAuthKey, rehydrate } = vi.hoisted(() => {
    const seen: Array<Uint8Array | null> = []
    return {
        requestKvAuthKey: vi.fn(),
        seen,
        setKvAuthKey: vi.fn((key: Uint8Array | null) => {
            seen.push(key === null ? null : new Uint8Array(key))
        }),
        rehydrate: vi.fn(async () => undefined),
    }
})

vi.mock('@perawallet/wallet-core-browser-runtime', () => ({
    requestKvAuthKey,
}))
vi.mock('@perawallet/wallet-extension-platform-chrome', () => ({
    setKvAuthKey,
}))
vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useNetworkStore: { persist: { rehydrate } },
}))

import { startOffscreenKvAuth } from '../kvAuth'

const KEY = new Uint8Array(32).fill(3)

const createLockState = (
    seed: boolean | undefined,
): {
    state: OffscreenLockState
    emit: (isLocked: boolean) => void
} => {
    let listener: (isLocked: boolean) => void = () => {}
    return {
        state: {
            isLocked: () => seed !== false,
            subscribe: next => {
                listener = next
                return () => {}
            },
            ready: Promise.resolve(seed),
        },
        emit: isLocked => listener(isLocked),
    }
}

describe('startOffscreenKvAuth', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        seen.length = 0
        requestKvAuthKey.mockImplementation(async () => new Uint8Array(KEY))
    })

    it('drops the key and leaves the store alone when it starts locked', async () => {
        const { state } = createLockState(true)

        await startOffscreenKvAuth(state)

        expect(seen).toEqual([null])
        expect(requestKvAuthKey).not.toHaveBeenCalled()
        expect(rehydrate).not.toHaveBeenCalled()
    })

    it('treats an unknown state as locked', async () => {
        const { state } = createLockState(undefined)

        await startOffscreenKvAuth(state)

        expect(seen).toEqual([null])
        expect(rehydrate).not.toHaveBeenCalled()
    })

    it('sets the key and re-reads the network store when it starts unlocked', async () => {
        const { state } = createLockState(false)

        await startOffscreenKvAuth(state)

        expect(seen).toEqual([KEY])
        expect(rehydrate).toHaveBeenCalledOnce()
    })

    it('does not re-read the store when the worker has no key to give', async () => {
        requestKvAuthKey.mockResolvedValue(null)
        const { state } = createLockState(false)

        await startOffscreenKvAuth(state)

        expect(seen).toEqual([null])
        expect(rehydrate).not.toHaveBeenCalled()
    })

    it('drops the key on a lock and fetches it again on the next unlock', async () => {
        const { state, emit } = createLockState(false)
        await startOffscreenKvAuth(state)
        seen.length = 0

        emit(true)
        expect(seen).toEqual([null])

        emit(false)
        await vi.waitFor(() => expect(seen).toEqual([null, KEY]))
    })

    it('ends locked when a lock lands before the reply to an unlock', async () => {
        const { state, emit } = createLockState(true)
        await startOffscreenKvAuth(state)
        seen.length = 0
        let resolveReply: (key: Uint8Array) => void = () => {}
        requestKvAuthKey.mockReturnValue(
            new Promise<Uint8Array>(resolve => {
                resolveReply = resolve
            }),
        )

        emit(false)
        emit(true)
        resolveReply(new Uint8Array(KEY))
        await vi.waitFor(() => expect(requestKvAuthKey).toHaveBeenCalled())
        await new Promise(resolve => setTimeout(resolve, 0))

        expect(seen).toEqual([null])
        expect(rehydrate).not.toHaveBeenCalled()
    })
})
