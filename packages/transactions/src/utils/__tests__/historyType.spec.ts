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

import { describe, expect, it } from 'vitest'
import {
    i18nKey,
    type TransactionSummary,
} from '@perawallet/wallet-core-chain-contract'
import { historyTypeOf } from '../historyType'

const summary = (
    overrides: Partial<TransactionSummary> = {},
): TransactionSummary => ({
    kind: 'contract-call',
    title: { key: i18nKey('transactions.list_item.contract_interaction') },
    icon: 'contract-call',
    direction: 'none',
    ...overrides,
})

describe('historyTypeOf', () => {
    it.each([
        ['swap', 'swaps'],
        ['approval', 'approvals'],
        ['transfer', 'transfers'],
        ['token-transfer', 'transfers'],
        ['nft-transfer', 'transfers'],
        ['chain-specific', 'other'],
    ] as const)('Given a %s summary, then %s', (kind, type) => {
        expect(historyTypeOf(summary({ kind }))).toBe(type)
    })

    it('Given a contract call naming a protocol action, then defi', () => {
        expect(historyTypeOf(summary({ isProtocolAction: true }))).toBe('defi')
    })

    it('Given a contract call nothing named, then other', () => {
        expect(historyTypeOf(summary({ isActionUnknown: true }))).toBe('other')
    })

    it('Given a contract call named a send or receive from what it moved, then transfers', () => {
        expect(
            historyTypeOf(
                summary({
                    title: { key: i18nKey('transactions.list_item.receive') },
                    isInferred: true,
                }),
            ),
        ).toBe('transfers')
    })
})
