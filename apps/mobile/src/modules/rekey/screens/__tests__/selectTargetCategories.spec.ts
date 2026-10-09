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

import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { AuthorityTargetCategory } from '@perawallet/wallet-core-accounts'
import { useRekeyToLedgerSelectTargetScreen } from '../rekey-to-ledger/RekeyToLedgerSelectTargetScreen/useRekeyToLedgerSelectTargetScreen'
import { useRekeyToQuantumSelectTargetScreen } from '../rekey-to-quantum/RekeyToQuantumSelectTargetScreen/useRekeyToQuantumSelectTargetScreen'
import { useRekeyToSharedSelectTargetScreen } from '../rekey-to-shared/RekeyToSharedSelectTargetScreen/useRekeyToSharedSelectTargetScreen'
import { useRekeyToStandardSelectTargetScreen } from '../rekey-to-standard/RekeyToStandardSelectTargetScreen/useRekeyToStandardSelectTargetScreen'
import {
    registerTargetFixtureChain,
    targetA,
    targetB,
} from './authorityTargetFixture'

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: vi.fn() }),
}))

vi.mock('@react-navigation/native', () => ({
    useRoute: () => ({ params: { sourceAddress: 'SRC' } }),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
}))

// The screens name a category, never a chain's kind id, so a chain is free to
// rename its kinds or file several under one flow.
describe.each<[AuthorityTargetCategory, () => { targets: unknown[] }]>([
    ['standard', useRekeyToStandardSelectTargetScreen],
    ['postQuantum', useRekeyToQuantumSelectTargetScreen],
    ['hardware', useRekeyToLedgerSelectTargetScreen],
    ['shared', useRekeyToSharedSelectTargetScreen],
])('the %s target screen', (category, useScreen) => {
    it('follows a kind the chain renames', () => {
        registerTargetFixtureChain([{ id: `renamed-${category}`, category }], {
            [`renamed-${category}`]: ['A'],
            [category]: ['B'],
        })

        const { result } = renderHook(() => useScreen())

        expect(result.current.targets).toEqual([targetA])
    })

    it('lists the targets of a kind the chain adds to the category', () => {
        registerTargetFixtureChain(
            [
                { id: 'first', category },
                { id: 'added', category },
            ],
            { first: ['B'], added: ['A'] },
        )

        const { result } = renderHook(() => useScreen())

        expect(result.current.targets).toEqual([targetA, targetB])
    })
})
