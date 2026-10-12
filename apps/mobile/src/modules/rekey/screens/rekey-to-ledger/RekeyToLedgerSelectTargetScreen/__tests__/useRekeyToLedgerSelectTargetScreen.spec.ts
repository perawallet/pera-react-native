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
import {
    registerTargetFixtureChain,
    sourceAccount,
    targetA,
    targetB,
} from '../../../__tests__/authorityTargetFixture'

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

// The real target lookup, so the screen lists what the fixture chain accepts.
vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
}))

describe('useRekeyToLedgerSelectTargetScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('lists the targets the chain accepts under its hardware kinds', () => {
        const adapter = registerTargetFixtureChain(
            [
                { id: 'fixture-hardware', category: 'hardware' },
                { id: 'fixture-standard', category: 'standard' },
            ],
            { 'fixture-hardware': ['A'], 'fixture-standard': ['B'] },
        )

        const { result } = renderHook(() =>
            useRekeyToLedgerSelectTargetScreen(),
        )

        expect(result.current.targets).toEqual([targetA])
        expect(adapter.authority!.isEligibleTarget).toHaveBeenCalledWith(
            'fixture-hardware',
            targetA,
            sourceAccount,
            [sourceAccount, targetA, targetB],
            expect.objectContaining({ chainId: 'algorand' }),
        )
    })

    it('lists nothing when the chain files no kind under hardware', () => {
        registerTargetFixtureChain(
            [{ id: 'fixture-standard', category: 'standard' }],
            { 'fixture-standard': ['A', 'B'] },
        )

        const { result } = renderHook(() =>
            useRekeyToLedgerSelectTargetScreen(),
        )

        expect(result.current.targets).toEqual([])
    })

    it('handleSelect navigates to the Confirm screen with source and target addresses', () => {
        registerTargetFixtureChain(
            [{ id: 'fixture-hardware', category: 'hardware' }],
            { 'fixture-hardware': ['A'] },
        )
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
