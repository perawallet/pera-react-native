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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useCreateNextHDAccount } from '../useCreateNextHDAccount'
import type { WalletAccount } from '../../models'
import {
    buildTestAccount,
    TEST_CUSTODY,
    testAccount,
} from '../../__tests__/accountFactory'
import { MAINNET_SCOPE } from '../../__tests__/fakeAccountsChain'

const mockCreateAccount = {
    createHdWalletAccount: vi.fn(),
    buildHdWalletAccount: vi.fn(),
}
const mockUseAllAccounts = vi.fn((): WalletAccount[] => [])

vi.mock('../useAllAccounts', () => ({
    useAllAccounts: () => mockUseAllAccounts(),
}))

vi.mock('../useCreateAccount', () => ({
    useCreateAccount: () => mockCreateAccount,
}))

// child key id → seed id: the seed (the wallet identifier) is the parent of
// each account's key.
const parentMap: Map<string, string> = new Map()
vi.mock('../../credentials', async importOriginal => {
    const actual = await importOriginal<typeof import('../../credentials')>()
    return {
        ...actual,
        seedOf: (account: WalletAccount) => {
            const keyPairId = actual.signingKeyOn(account, 'algorand')
            return keyPairId ? parentMap.get(keyPairId) : undefined
        },
    }
})

const hd = (id: string, keyPairId: string, account: number): WalletAccount =>
    buildTestAccount(
        {
            kind: 'local',
            seed: TEST_CUSTODY.hd.seed,
            hd: { account, keyIndex: 0 },
        },
        { algorand: { address: `${id}-ADDR`, keyPairId } },
        { id },
    )

const HD_ACCOUNT = hd('hd-1', 'wallet-1-acc0-idx0-dt9', 0)

describe('useCreateNextHDAccount', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseAllAccounts.mockReturnValue([])
        parentMap.clear()
        parentMap.set('wallet-1-acc0-idx0-dt9', 'wallet-1')
    })

    test('hasHDWallet is false when no HD account exists', () => {
        mockUseAllAccounts.mockReturnValue([testAccount('local', 'SINGLE')])

        const { result } = renderHook(() =>
            useCreateNextHDAccount(MAINNET_SCOPE),
        )

        expect(result.current.hasHDWallet).toBe(false)
    })

    test('hasHDWallet is true when an HD account exists', () => {
        mockUseAllAccounts.mockReturnValue([HD_ACCOUNT])

        const { result } = renderHook(() =>
            useCreateNextHDAccount(MAINNET_SCOPE),
        )

        expect(result.current.hasHDWallet).toBe(true)
    })

    test('createNextHDAccount returns null when no HD account exists', async () => {
        const { result } = renderHook(() =>
            useCreateNextHDAccount(MAINNET_SCOPE),
        )

        let account: Nullable<WalletAccount> = null
        await act(async () => {
            account = await result.current.createNextHDAccount()
        })

        expect(account).toBeNull()
        expect(mockCreateAccount.createHdWalletAccount).not.toHaveBeenCalled()
    })

    test('createNextHDAccount takes the account index after the wallet highest', async () => {
        parentMap.set('wallet-1-acc1-idx0-dt9', 'wallet-1')
        parentMap.set('wallet-2-acc5-idx0-dt9', 'wallet-2')
        mockUseAllAccounts.mockReturnValue([
            HD_ACCOUNT,
            hd('hd-2', 'wallet-1-acc1-idx0-dt9', 1),
            // Another wallet's higher index does not count.
            hd('other', 'wallet-2-acc5-idx0-dt9', 5),
        ])
        const created = hd('new-hd', 'wallet-1-acc2-idx0-dt9', 2)
        mockCreateAccount.createHdWalletAccount.mockResolvedValue(created)

        const { result } = renderHook(() =>
            useCreateNextHDAccount(MAINNET_SCOPE),
        )

        let account: Nullable<WalletAccount> = null
        await act(async () => {
            account = await result.current.createNextHDAccount()
        })

        expect(account).toBe(created)
        expect(mockCreateAccount.createHdWalletAccount).toHaveBeenCalledWith({
            walletId: 'wallet-1',
            account: 2,
            keyIndex: 0,
        })
    })

    test('buildNextHDAccount builds the same slot without saving', async () => {
        mockUseAllAccounts.mockReturnValue([HD_ACCOUNT])

        const { result } = renderHook(() =>
            useCreateNextHDAccount(MAINNET_SCOPE),
        )

        await act(async () => {
            await result.current.buildNextHDAccount()
        })

        expect(mockCreateAccount.buildHdWalletAccount).toHaveBeenCalledWith({
            walletId: 'wallet-1',
            account: 1,
            keyIndex: 0,
        })
        expect(mockCreateAccount.createHdWalletAccount).not.toHaveBeenCalled()
    })

    test('returns null when the first HD account has no seed in the keystore', async () => {
        parentMap.clear()
        mockUseAllAccounts.mockReturnValue([HD_ACCOUNT])

        const { result } = renderHook(() =>
            useCreateNextHDAccount(MAINNET_SCOPE),
        )

        let account: Nullable<WalletAccount> = HD_ACCOUNT
        await act(async () => {
            account = await result.current.createNextHDAccount()
        })

        expect(account).toBeNull()
    })
})
