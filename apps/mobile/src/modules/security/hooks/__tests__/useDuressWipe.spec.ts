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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
    wipeAllUserData: vi.fn(),
    createHdWalletAccount: vi.fn(),
    clearAccountsStore: vi.fn(),
}))

vi.mock('@modules/settings/hooks/useDeleteAllData', () => ({
    useDeleteAllData: () => ({
        wipeAllUserData: mocks.wipeAllUserData,
        deleteAllData: mocks.wipeAllUserData,
    }),
    clearAccountsStore: mocks.clearAccountsStore,
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useCreateAccount: () => ({
        createHdWalletAccount: mocks.createHdWalletAccount,
    }),
}))

import { useDuressWipe } from '../useDuressWipe'

describe('useDuressWipe', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.wipeAllUserData.mockResolvedValue(undefined)
        mocks.createHdWalletAccount.mockResolvedValue({
            id: 'decoy',
            address: 'DECOY',
        })
    })

    test('wipes all user data and provisions a fresh decoy account', async () => {
        const { result } = renderHook(() => useDuressWipe())
        await act(async () => {
            await result.current.performDuressWipe()
        })
        expect(mocks.wipeAllUserData).toHaveBeenCalledTimes(1)
        expect(mocks.createHdWalletAccount).toHaveBeenCalledWith({
            account: 0,
            keyIndex: 0,
        })
    })

    test('on wipe failure drops the user to onboarding (no decoy)', async () => {
        mocks.wipeAllUserData.mockRejectedValueOnce(new Error('boom'))

        const { result } = renderHook(() => useDuressWipe())
        await act(async () => {
            await result.current.performDuressWipe()
        })

        expect(mocks.clearAccountsStore).toHaveBeenCalled()
        expect(mocks.createHdWalletAccount).not.toHaveBeenCalled()
    })

    test('on decoy creation failure, falls through cleanly without rethrowing', async () => {
        mocks.createHdWalletAccount.mockRejectedValueOnce(new Error('boom'))

        const { result } = renderHook(() => useDuressWipe())
        await expect(
            (async () => {
                await act(async () => {
                    await result.current.performDuressWipe()
                })
            })(),
        ).resolves.toBeUndefined()
    })
})
