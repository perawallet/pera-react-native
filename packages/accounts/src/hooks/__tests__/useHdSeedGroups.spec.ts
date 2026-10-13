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
import { renderHook } from '@testing-library/react'
import { useHdSeedGroups } from '../useHdSeedGroups'
import type { WalletAccount } from '../../models'
import {
    buildTestAccount,
    TEST_CUSTODY,
    testAccount,
} from '../../__tests__/accountFactory'

const mockUseAllAccounts = vi.fn((): WalletAccount[] => [])

vi.mock('../useAllAccounts', () => ({
    useAllAccounts: () => mockUseAllAccounts(),
}))

// child id → seed id. Reset in beforeEach. The grouping logic walks the
// account's key (a child id) up to the parent seed via this map.
const parentMap: Map<string, string> = new Map()

vi.mock('@perawallet/wallet-core-kms', () => ({
    useKMS: () => ({ keys: [] }),
}))

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

const hd = (
    id: string,
    address: string,
    keyPairId: string,
    keyIndex: number,
    name?: string,
): WalletAccount =>
    buildTestAccount(
        {
            kind: 'local',
            seed: TEST_CUSTODY.hd.seed,
            hd: { account: 0, keyIndex },
        },
        { algorand: { address, keyPairId } },
        { id, ...(name ? { name } : {}) },
    )

const HD_ACCOUNT_WALLET_1 = hd(
    'hd-1',
    'HD_ADDRESS_1',
    'wallet-1-acc0-idx0-dt9',
    0,
    'My Wallet',
)
const HD_ACCOUNT_WALLET_1_B = hd(
    'hd-1b',
    'HD_ADDRESS_1B',
    'wallet-1-acc0-idx1-dt9',
    1,
)
const HD_ACCOUNT_WALLET_2 = hd(
    'hd-2',
    'HD_ADDRESS_2',
    'wallet-2-acc0-idx0-dt9',
    0,
    'Second Wallet',
)
const SINGLE_KEY_ACCOUNT = testAccount('local', 'SINGLE_ADDRESS', {
    id: 'single-1',
})
const WATCH_ACCOUNT = testAccount('watch', 'WATCH_ADDRESS', { id: 'watch-1' })

const seedHDChildren = () => {
    parentMap.set('wallet-1-acc0-idx0-dt9', 'wallet-1')
    parentMap.set('wallet-1-acc0-idx1-dt9', 'wallet-1')
    parentMap.set('wallet-2-acc0-idx0-dt9', 'wallet-2')
    parentMap.set('local-key', 'single-seed-1')
}

describe('useHdSeedGroups', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseAllAccounts.mockReturnValue([])
        parentMap.clear()
        seedHDChildren()
    })

    test('returns empty groups when no accounts exist', () => {
        const { result } = renderHook(() => useHdSeedGroups())

        expect(result.current.hdSeedGroups).toEqual([])
        expect(result.current.hasMultipleHdSeeds).toBe(false)
    })

    test('returns empty groups when only non-HD accounts exist', () => {
        mockUseAllAccounts.mockReturnValue([SINGLE_KEY_ACCOUNT, WATCH_ACCOUNT])

        const { result } = renderHook(() => useHdSeedGroups())

        expect(result.current.hdSeedGroups).toEqual([])
        expect(result.current.hasMultipleHdSeeds).toBe(false)
    })

    test('returns single group for one HD wallet', () => {
        mockUseAllAccounts.mockReturnValue([
            HD_ACCOUNT_WALLET_1,
            HD_ACCOUNT_WALLET_1_B,
        ])

        const { result } = renderHook(() => useHdSeedGroups())

        expect(result.current.hdSeedGroups).toHaveLength(1)
        expect(result.current.hdSeedGroups[0].seedKeyId).toBe('wallet-1')
        expect(result.current.hdSeedGroups[0].accountCount).toBe(2)
        expect(result.current.hdSeedGroups[0].firstAccount).toBe(
            HD_ACCOUNT_WALLET_1,
        )
        expect(result.current.hasMultipleHdSeeds).toBe(false)
    })

    test('returns multiple groups for multiple HD wallets', () => {
        mockUseAllAccounts.mockReturnValue([
            HD_ACCOUNT_WALLET_1,
            HD_ACCOUNT_WALLET_1_B,
            HD_ACCOUNT_WALLET_2,
        ])

        const { result } = renderHook(() => useHdSeedGroups())

        expect(result.current.hdSeedGroups).toHaveLength(2)
        expect(result.current.hasMultipleHdSeeds).toBe(true)

        const group1 = result.current.hdSeedGroups.find(
            g => g.seedKeyId === 'wallet-1',
        )!
        expect(group1.accountCount).toBe(2)
        expect(group1.firstAccount).toBe(HD_ACCOUNT_WALLET_1)

        const group2 = result.current.hdSeedGroups.find(
            g => g.seedKeyId === 'wallet-2',
        )!
        expect(group2.accountCount).toBe(1)
        expect(group2.firstAccount).toBe(HD_ACCOUNT_WALLET_2)
    })

    test('filters out non-HD wallet accounts from groups', () => {
        mockUseAllAccounts.mockReturnValue([
            HD_ACCOUNT_WALLET_1,
            SINGLE_KEY_ACCOUNT,
            WATCH_ACCOUNT,
            HD_ACCOUNT_WALLET_2,
        ])

        const { result } = renderHook(() => useHdSeedGroups())

        expect(result.current.hdSeedGroups).toHaveLength(2)
        expect(result.current.hasMultipleHdSeeds).toBe(true)
    })

    test('firstAccount points to the first account in each group', () => {
        mockUseAllAccounts.mockReturnValue([
            HD_ACCOUNT_WALLET_1,
            HD_ACCOUNT_WALLET_1_B,
        ])

        const { result } = renderHook(() => useHdSeedGroups())

        expect(result.current.hdSeedGroups[0].firstAccount.id).toBe('hd-1')
    })
})
