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
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { useTransactionWarnings } from '../useTransactionWarnings'

const SENDER = 'SENDER_ADDR'
const TARGET = 'TARGET_ADDR'

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: () => [{ address: SENDER }],
    useSigningAccounts: () => [{ address: SENDER }],
}))

// Only the close fields matter here; the rest of the displayable shape is
// irrelevant to the aggregator under test.
const makeTx = (overrides: object) =>
    ({ sender: SENDER, ...overrides }) as unknown as PeraDisplayableTransaction

describe('useTransactionWarnings', () => {
    it('buckets a payment close-remainder as close-account', () => {
        const { result } = renderHook(() =>
            useTransactionWarnings(
                makeTx({
                    paymentTransaction: { closeRemainderTo: TARGET },
                }),
            ),
        )

        expect(result.current.warningCount).toBe(1)
        expect(result.current.warningsByType['close-account']).toEqual([
            {
                type: 'close-account',
                senderAddress: SENDER,
                targetAddress: TARGET,
            },
        ])
        expect(result.current.warningsByType['close-asset']).toEqual([])
    })

    // an ASA opt-out is a much smaller action than emptying an
    // account, so it must land in its own bucket and get its own copy.
    it('buckets an asset-transfer close-to as close-asset', () => {
        const { result } = renderHook(() =>
            useTransactionWarnings(
                makeTx({
                    assetTransferTransaction: { closeTo: TARGET },
                }),
            ),
        )

        expect(result.current.warningsByType['close-asset']).toEqual([
            {
                type: 'close-asset',
                senderAddress: SENDER,
                targetAddress: TARGET,
            },
        ])
        expect(result.current.warningsByType['close-account']).toEqual([])
    })

    it('reports no warnings for a plain payment', () => {
        const { result } = renderHook(() =>
            useTransactionWarnings(
                makeTx({ paymentTransaction: { amount: 1n } }),
            ),
        )

        expect(result.current.warningCount).toBe(0)
    })
})
