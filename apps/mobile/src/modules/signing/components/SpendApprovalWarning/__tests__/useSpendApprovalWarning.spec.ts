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
import { formatDatetime } from '@perawallet/wallet-core-shared'
import {
    useSpendApprovalWarning as useWarning,
    type SpendApprovalContext,
} from '../useSpendApprovalWarning'

vi.mock('@hooks/useLanguage')

const SIGNATURE: SpendApprovalContext = { requestKind: 'signature' }
const TRANSACTION: SpendApprovalContext = { requestKind: 'transaction' }

const useSpendApprovalWarning = (
    value: SpendApproval,
    context: SpendApprovalContext = SIGNATURE,
) => useWarning(value, context)

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

    it('warns that the spender can move the NFT when every allowance is a single NFT', () => {
        const nft: SpendAllowance = {
            assetRef: { chainId: 'ethereum', assetId: '0xpositions/7' },
            amount: new Decimal(1),
            nft: { collection: '0xpositions', tokenId: '7' },
        }

        const { result } = renderHook(() =>
            useSpendApprovalWarning(approval({ allowances: [nft] })),
        )

        expect(result.current.rows).toEqual([
            expect.objectContaining({
                type: 'spend',
                message: 'signing.spend_approval.nft_spend_warning',
            }),
        ])
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

// An on-chain allowance has no deadline, and the chain reports an unlimited
// one the way an unlimited permit is reported: without an amount.
describe('an unlimited approval sent as a transaction', () => {
    it('warns that it is unlimited, as an unlimited permit does, and that it never expires', () => {
        const transaction = approval({
            allowances: [unlimited('0xusdc')],
            deadline: undefined,
            isLongLived: true,
        })
        const permit = approval({ allowances: [unlimited('0xusdc')] })

        expect(rowTypes(transaction)).toEqual([
            'spend',
            'unlimited',
            'no-expiry',
        ])
        expect(rowTypes(permit)).toContain('unlimited')
    })

    describe('with a well-known spender', () => {
        const PERMIT2 = { name: 'Permit2', projectDomain: 'uniswap.org' }

        it('swaps the danger copy for a neutral note and names the spender', () => {
            const { result } = renderHook(() =>
                useSpendApprovalWarning(
                    approval({
                        knownSpender: PERMIT2,
                        allowances: [unlimited('0xtsla')],
                        deadline: undefined,
                        isLongLived: true,
                    }),
                ),
            )

            expect(result.current.knownSpenderName).toBe('Permit2')
            expect(result.current.rows).toEqual([
                {
                    type: 'spend',
                    icon: 'outflow',
                    message: 'signing.spend_approval.known_spend_note',
                    caption: 'signing.spend_approval.spender_caption',
                },
                {
                    type: 'unlimited',
                    icon: 'info',
                    message: 'signing.spend_approval.known_unlimited_note',
                    caption: undefined,
                },
                expect.objectContaining({
                    type: 'no-expiry',
                    message: 'signing.spend_approval.no_deadline_warning',
                }),
            ])
        })

        it('leaves knownSpenderName unset for an unlisted spender', () => {
            const { result } = renderHook(() =>
                useSpendApprovalWarning(approval()),
            )

            expect(result.current.knownSpenderName).toBeUndefined()
        })

        it('is trusted with today’s copy when the request has no attested origin', () => {
            const { result } = renderHook(() =>
                useSpendApprovalWarning(
                    approval({ knownSpender: PERMIT2 }),
                    TRANSACTION,
                ),
            )

            expect(result.current.isTrusted).toBe(true)
            expect(result.current.rows).toEqual([
                expect.objectContaining({
                    type: 'spend',
                    message: 'signing.spend_approval.known_spend_note',
                }),
            ])
        })

        it('is trusted when the attested origin is the project’s own site', () => {
            const { result } = renderHook(() =>
                useSpendApprovalWarning(approval({ knownSpender: PERMIT2 }), {
                    ...TRANSACTION,
                    verifiedOrigin: 'https://app.uniswap.org',
                }),
            )

            expect(result.current.isTrusted).toBe(true)
        })

        it('is not trusted when the attested origin is another site, leading with the mismatch and keeping the name', () => {
            const { result } = renderHook(() =>
                useSpendApprovalWarning(
                    approval({
                        knownSpender: PERMIT2,
                        allowances: [unlimited('0xtsla')],
                    }),
                    { ...TRANSACTION, verifiedOrigin: 'https://evil.example' },
                ),
            )

            expect(result.current.isTrusted).toBe(false)
            expect(result.current.knownSpenderName).toBe('Permit2')
            expect(result.current.rows.map(row => row.type)).toEqual([
                'site-mismatch',
                'spend',
                'unlimited',
            ])
            expect(result.current.rows[0]).toEqual({
                type: 'site-mismatch',
                icon: 'warning',
                message: 'signing.spend_approval.known_site_mismatch',
            })
            expect(result.current.rows[1].message).toBe(
                'signing.spend_approval.spend_warning_transaction',
            )
            expect(result.current.rows[2].message).toBe(
                'signing.spend_approval.unlimited_warning',
            )
        })

        it.each(['mismatch', 'scam'] as const)(
            'is not trusted, with the danger copy, when Verify rates the request %s',
            status => {
                const { result } = renderHook(() =>
                    useSpendApprovalWarning(
                        approval({ knownSpender: PERMIT2 }),
                        {
                            ...TRANSACTION,
                            source: {
                                url: 'https://app.uniswap.org',
                                verification: {
                                    status,
                                    verifiedOrigin: 'https://evil.example',
                                },
                            },
                        },
                    ),
                )

                expect(result.current.isTrusted).toBe(false)
                expect(result.current.rows).toEqual([
                    expect.objectContaining({
                        type: 'spend',
                        message:
                            'signing.spend_approval.spend_warning_transaction',
                    }),
                ])
            },
        )

        it('is not trusted for an unknown spender asked for from a matching site', () => {
            const { result } = renderHook(() =>
                useSpendApprovalWarning(approval(), {
                    ...TRANSACTION,
                    verifiedOrigin: 'https://app.uniswap.org',
                }),
            )

            expect(result.current.isTrusted).toBe(false)
            expect(result.current.rows).toEqual([
                expect.objectContaining({
                    type: 'spend',
                    message: 'signing.spend_approval.spend_warning_transaction',
                }),
            ])
        })
    })

    describe('by request kind', () => {
        it('words a transaction’s spend row as a transaction and a signature’s as a signature', () => {
            const transaction = renderHook(() =>
                useSpendApprovalWarning(approval(), TRANSACTION),
            ).result.current
            const signature = renderHook(() =>
                useSpendApprovalWarning(approval(), SIGNATURE),
            ).result.current

            expect(transaction.rows[0].message).toBe(
                'signing.spend_approval.spend_warning_transaction',
            )
            expect(signature.rows[0].message).toBe(
                'signing.spend_approval.spend_warning',
            )
        })

        it('shows the deadline for signatures only', () => {
            const transaction = renderHook(() =>
                useSpendApprovalWarning(approval(), TRANSACTION),
            ).result.current
            const signature = renderHook(() =>
                useSpendApprovalWarning(approval(), SIGNATURE),
            ).result.current

            expect(transaction.showsDeadline).toBe(false)
            expect(signature.showsDeadline).toBe(true)
        })
    })
})
