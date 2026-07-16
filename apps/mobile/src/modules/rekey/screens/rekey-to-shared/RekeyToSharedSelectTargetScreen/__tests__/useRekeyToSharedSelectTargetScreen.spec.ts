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
import { useRekeyToSharedSelectTargetScreen } from '../useRekeyToSharedSelectTargetScreen'

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

const mockIsEligibleSharedRekeyTarget = vi.fn(
    (
        account: WalletAccount,
        _source: WalletAccount,
        _allAccounts: WalletAccount[],
    ) => account.address !== 'SRC',
)
vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: () => [sourceAccount, targetA, targetB],
    useFindAccountByAddress: (address: string) =>
        address === 'SRC' ? sourceAccount : undefined,
    isEligibleSharedRekeyTarget: (
        account: WalletAccount,
        source: WalletAccount,
        allAccounts: WalletAccount[],
    ) => mockIsEligibleSharedRekeyTarget(account, source, allAccounts),
}))

describe('useRekeyToSharedSelectTargetScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('filters out ineligible accounts via isEligibleSharedRekeyTarget', () => {
        const { result } = renderHook(() =>
            useRekeyToSharedSelectTargetScreen(),
        )

        expect(result.current.targets).toEqual([targetA, targetB])
    })

    it('passes the resolved source account to isEligibleSharedRekeyTarget', () => {
        renderHook(() => useRekeyToSharedSelectTargetScreen())

        expect(mockIsEligibleSharedRekeyTarget).toHaveBeenCalledWith(
            targetA,
            sourceAccount,
            [sourceAccount, targetA, targetB],
        )
    })

    it('handleSelect navigates to the Confirm screen with source and target addresses', () => {
        const { result } = renderHook(() =>
            useRekeyToSharedSelectTargetScreen(),
        )

        act(() => {
            result.current.handleSelect(targetA)
        })

        expect(mockNavigate).toHaveBeenCalledWith('RekeyToShared', {
            screen: 'RekeyToSharedConfirm',
            params: {
                sourceAddress: 'SRC',
                targetAddress: 'A',
            },
        })
    })
})
