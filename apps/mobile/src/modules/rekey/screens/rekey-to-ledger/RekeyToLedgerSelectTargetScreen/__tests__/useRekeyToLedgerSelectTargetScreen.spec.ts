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
import { renderHook, act } from '@testing-library/react'
import { useRekeyToLedgerSelectTargetScreen } from '../useRekeyToLedgerSelectTargetScreen'

import type { WalletAccount } from '@perawallet/wallet-core-accounts'

const sourceAccount = { address: 'SRC', name: 'Src' } as WalletAccount
const targetA = { address: 'A', name: 'A' } as WalletAccount
const targetB = { address: 'B', name: 'B' } as WalletAccount

const mockNavigate = vi.fn()
vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        navigate: mockNavigate,
    }),
}))

vi.mock('@react-navigation/native', () => ({
    useRoute: () => ({
        params: { sourceAddress: 'SRC' },
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: () => [sourceAccount, targetA, targetB],
    isEligibleLedgerRekeyTarget: (account: WalletAccount) =>
        account.address !== 'SRC',
}))

describe('useRekeyToLedgerSelectTargetScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('filters out ineligible accounts via isEligibleLedgerRekeyTarget', () => {
        const { result } = renderHook(() =>
            useRekeyToLedgerSelectTargetScreen(),
        )

        expect(result.current.targets).toEqual([targetA, targetB])
    })

    it('handleSelect navigates to the Confirm screen with source and target addresses', () => {
        const { result } = renderHook(() =>
            useRekeyToLedgerSelectTargetScreen(),
        )

        act(() => {
            result.current.handleSelect(targetA)
        })

        expect(mockNavigate).toHaveBeenCalledWith('RekeyToLedger', {
            screen: 'RekeyToLedgerConfirm',
            params: {
                sourceAddress: 'SRC',
                targetAddress: 'A',
            },
        })
    })
})
