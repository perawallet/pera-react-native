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

const mocks = vi.hoisted(() => ({
    readPasskeySetupPending: vi.fn<() => Promise<boolean>>(),
    writePasskeySetupPending: vi.fn<(isPending: boolean) => Promise<void>>(),
}))

vi.mock('@perawallet/wallet-extension-keystore-chrome', () => ({
    readPasskeySetupPending: mocks.readPasskeySetupPending,
    writePasskeySetupPending: mocks.writePasskeySetupPending,
}))

import { usePasskeySetupStore } from '../usePasskeySetupStore.web'

const held = <T>() => {
    let resolve: (value: T) => void = () => {}
    let reject: (error: unknown) => void = () => {}
    const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
    })
    return { promise, resolve, reject }
}

describe('usePasskeySetupStore', () => {
    beforeEach(() => {
        usePasskeySetupStore.getState().resetState()
        mocks.readPasskeySetupPending.mockResolvedValue(false)
        mocks.writePasskeySetupPending.mockResolvedValue(undefined)
    })

    it('starts unknown until hydrated', () => {
        expect(usePasskeySetupStore.getState().isPending).toBeNull()
    })

    it('hydrate reads the flag from the keystore', async () => {
        mocks.readPasskeySetupPending.mockResolvedValueOnce(true)

        await usePasskeySetupStore.getState().hydrate()

        expect(usePasskeySetupStore.getState().isPending).toBe(true)
    })

    it('hydrate does not overwrite a value written while the read was in flight', async () => {
        const read = held<boolean>()
        mocks.readPasskeySetupPending.mockReturnValueOnce(read.promise)

        const hydrating = usePasskeySetupStore.getState().hydrate()
        await usePasskeySetupStore.getState().setPending(true)
        read.resolve(false)
        await hydrating

        expect(usePasskeySetupStore.getState().isPending).toBe(true)
    })

    it('setPending writes through before the in-memory flag moves', async () => {
        const write = held<void>()
        mocks.writePasskeySetupPending.mockReturnValueOnce(write.promise)

        const setting = usePasskeySetupStore.getState().setPending(true)
        expect(usePasskeySetupStore.getState().isPending).toBeNull()
        write.resolve()
        await setting

        expect(usePasskeySetupStore.getState().isPending).toBe(true)
        expect(mocks.writePasskeySetupPending).toHaveBeenCalledWith(true)
    })

    it('setPending rejects and leaves the flag unchanged when the write fails', async () => {
        mocks.writePasskeySetupPending.mockRejectedValueOnce(new Error('quota'))

        await expect(
            usePasskeySetupStore.getState().setPending(true),
        ).rejects.toThrow('quota')

        expect(usePasskeySetupStore.getState().isPending).toBeNull()
    })

    it('resetState returns to unknown', async () => {
        await usePasskeySetupStore.getState().setPending(true)

        usePasskeySetupStore.getState().resetState()

        expect(usePasskeySetupStore.getState().isPending).toBeNull()
    })
})
