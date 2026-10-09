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
import { useRekeyToQuantumSelectTargetScreen } from '../useRekeyToQuantumSelectTargetScreen'

import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { capabilityState } from '@test-utils/capability-mock'

const sourceAccount = {
    id: 'SRC',
    name: 'Src',
    custody: { kind: 'watch' },
    chains: { algorand: { address: 'SRC' } },
} as WalletAccount
const targetA = {
    id: 'A',
    name: 'A',
    custody: { kind: 'watch' },
    chains: { algorand: { address: 'A' } },
} as WalletAccount
const targetB = {
    id: 'B',
    name: 'B',
    custody: { kind: 'watch' },
    chains: { algorand: { address: 'B' } },
} as WalletAccount

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

vi.mock('@hooks/useCapability', async () =>
    (await import('@test-utils/capability-mock')).capabilityHookMock(),
)

const mockUseAuthorityTargets = vi.fn(
    (
        _source: WalletAccount | undefined,
        _kind: string,
        _scope: unknown,
        _options?: object,
    ) => [targetA, targetB],
)
vi.mock('@perawallet/wallet-core-accounts', () => ({
    useFindAccountByAddress: (address: string) =>
        address === 'SRC' ? sourceAccount : undefined,
    addressOn: (account: WalletAccount, scope: { chainId: 'algorand' }) =>
        account.chains[scope.chainId]?.address,
    useAuthorityTargets: (
        source: WalletAccount | undefined,
        kind: string,
        scope: unknown,
        options?: object,
    ) => mockUseAuthorityTargets(source, kind, scope, options),
}))

describe('useRekeyToQuantumSelectTargetScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        capabilityState.reset()
    })

    it('returns the targets the chain accepts for the resolved source', () => {
        const { result } = renderHook(() =>
            useRekeyToQuantumSelectTargetScreen(),
        )

        expect(result.current.targets).toEqual([targetA, targetB])
        expect(mockUseAuthorityTargets).toHaveBeenCalledWith(
            sourceAccount,
            'quantum',
            expect.objectContaining({ chainId: 'algorand' }),
            { isQuantumTargetEnabled: true },
        )
    })

    it('passes the quantum flag through when quantum accounts are disabled', () => {
        capabilityState.turnOff('quantumAccounts')

        renderHook(() => useRekeyToQuantumSelectTargetScreen())

        expect(mockUseAuthorityTargets).toHaveBeenCalledWith(
            sourceAccount,
            'quantum',
            expect.objectContaining({ chainId: 'algorand' }),
            { isQuantumTargetEnabled: false },
        )
    })

    it('handleSelect navigates to the Confirm screen with source and target addresses', () => {
        const { result } = renderHook(() =>
            useRekeyToQuantumSelectTargetScreen(),
        )

        act(() => {
            result.current.handleSelect(targetA)
        })

        expect(mockNavigate).toHaveBeenCalledWith('RekeyToQuantum', {
            screen: 'RekeyToQuantumConfirm',
            params: {
                sourceAddress: 'SRC',
                targetAddress: 'A',
            },
        })
    })
})
