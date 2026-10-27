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

import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { describe, expect, it, vi } from 'vitest'
import type {
    SpendAllowance,
    SpendApproval,
} from '@perawallet/wallet-core-chain-contract'
import { spendApprovalOfCall } from '@perawallet/wallet-core-chain-ethereum'
import { formatDatetime } from '@perawallet/wallet-core-shared'
import {
    useCollectionApprovalWarning,
    useSpendApprovalWarning,
} from '../useSpendApprovalWarning'

vi.mock('@hooks/useLanguage')

const SPENDER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const DEADLINE = Date.UTC(2026, 0, 31)

const limited = (assetId: string): SpendAllowance => ({
    assetRef: { chainId: 'ethereum', assetId },
    amount: new Decimal(1_000_000),
})
const unlimited = (assetId: string): SpendAllowance => ({
    assetRef: { chainId: 'ethereum', assetId },
})

const approval = (overrides: Partial<SpendApproval> = {}): SpendApproval => ({
    spender: SPENDER,
    allowances: [limited('0xusdc')],
    deadline: DEADLINE,
    isLongLived: false,
    ...overrides,
})

const rowTypes = (value: SpendApproval) =>
    renderHook(() => useSpendApprovalWarning(value)).result.current.rows.map(
        row => row.type,
    )

describe('useSpendApprovalWarning', () => {
    it('warns only that the spender can move tokens when the approval is finite and short-lived', () => {
        const { result } = renderHook(() => useSpendApprovalWarning(approval()))

        expect(result.current.rows).toEqual([
            {
                type: 'spend',
                icon: 'outflow',
                message: 'signing.spend_approval.spend_warning',
                emphasis: 'signing.spend_approval.spend_warning_bold',
                caption: 'signing.spend_approval.spender_caption',
            },
        ])
        expect(result.current.deadlineText).toBe(
            formatDatetime(new Date(DEADLINE)),
        )
    })

    it('adds the unlimited row when any one allowance is unlimited', () => {
        expect(
            rowTypes(
                approval({
                    allowances: [limited('0xusdc'), unlimited('0xweth')],
                }),
            ),
        ).toEqual(['spend', 'unlimited'])
    })

    it('adds the long-lived row when a deadline is more than a year out', () => {
        expect(rowTypes(approval({ isLongLived: true }))).toEqual([
            'spend',
            'long-lived',
        ])
    })

    it('reads no deadline as never expiring', () => {
        const { result } = renderHook(() =>
            useSpendApprovalWarning(
                approval({ deadline: undefined, isLongLived: true }),
            ),
        )

        expect(result.current.rows.map(row => row.type)).toEqual([
            'spend',
            'no-expiry',
        ])
        expect(result.current.deadlineText).toBe('signing.spend_approval.never')
    })

    it('orders spend, unlimited, then no-expiry', () => {
        expect(
            rowTypes(
                approval({
                    allowances: [unlimited('0xusdc')],
                    deadline: undefined,
                    isLongLived: true,
                }),
            ),
        ).toEqual(['spend', 'unlimited', 'no-expiry'])
    })
})

describe('an unlimited approval sent as a transaction', () => {
    it('warns the same way an unlimited permit does', () => {
        const transaction = spendApprovalOfCall(
            {
                kind: 'approve',
                contract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
                spender: SPENDER,
                value: new Decimal(2).pow(256).minus(1),
            },
            'ethereum',
        )
        const permit = approval({ allowances: [unlimited('0xusdc')] })

        expect(transaction).toBeDefined()
        expect(rowTypes(transaction as SpendApproval)).toContain('unlimited')
        expect(rowTypes(permit)).toContain('unlimited')
    })
})

describe('useCollectionApprovalWarning', () => {
    it('warns that the operator can take every item, naming the operator', () => {
        const { result } = renderHook(() =>
            useCollectionApprovalWarning(SPENDER),
        )

        expect(result.current.rows).toEqual([
            {
                type: 'collection',
                icon: 'warning',
                message: 'signing.collection_approval.warning',
                emphasis: 'signing.spend_approval.spend_warning_bold',
                caption: 'signing.spend_approval.spender_caption',
            },
        ])
    })
})
