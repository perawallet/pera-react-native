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
import { useRekeyToStandardSelectTargetScreen } from '../useRekeyToStandardSelectTargetScreen'
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

describe('useRekeyToStandardSelectTargetScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('lists the targets the chain accepts under its standard kinds', () => {
        const adapter = registerTargetFixtureChain(
            [
                { id: 'fixture-standard', category: 'standard' },
                { id: 'fixture-hardware', category: 'hardware' },
            ],
            { 'fixture-standard': ['A'], 'fixture-hardware': ['B'] },
        )

        const { result } = renderHook(() =>
            useRekeyToStandardSelectTargetScreen(),
        )

        expect(result.current.targets).toEqual([targetA])
        expect(adapter.authority!.isEligibleTarget).toHaveBeenCalledWith(
            'fixture-standard',
            targetA,
            sourceAccount,
            [sourceAccount, targetA, targetB],
            expect.objectContaining({ chainId: 'algorand' }),
        )
    })

    it('lists nothing when the chain files no kind under standard', () => {
        registerTargetFixtureChain(
            [{ id: 'fixture-hardware', category: 'hardware' }],
            { 'fixture-hardware': ['A', 'B'] },
        )

        const { result } = renderHook(() =>
            useRekeyToStandardSelectTargetScreen(),
        )

        expect(result.current.targets).toEqual([])
    })

    it('handleSelect navigates to the Confirm screen with source and target addresses', () => {
        registerTargetFixtureChain(
            [{ id: 'fixture-standard', category: 'standard' }],
            { 'fixture-standard': ['A'] },
        )
        const { result } = renderHook(() =>
            useRekeyToStandardSelectTargetScreen(),
        )

        act(() => {
            result.current.handleSelect(targetA)
        })

        expect(mockNavigate).toHaveBeenCalledWith('RekeyToStandard', {
            screen: 'RekeyToStandardConfirm',
            params: {
                sourceAddress: 'SRC',
                targetAddress: 'A',
            },
        })
    })
})
