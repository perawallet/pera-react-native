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

import { beforeEach, describe, expect, it } from 'vitest'
import type {
    AssetRef,
    ChainId,
    ChainScope,
    TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import type { HistoryChainAdapter } from '../history-adapter'

export interface HistoryContractFixtures {
    scope: ChainScope
    /** The account whose history is read. */
    address: string
    nativeAsset: AssetRef
    /**
     * Serves two pages for `address`. The first has a next page and includes a
     * native transfer that `address` sent. The second has no next page.
     */
    arrangeTwoPages(): void
    arrangeEmpty(): void
}

const STATUSES: readonly TransactionRecord['status'][] = [
    'pending',
    'confirmed',
    'failed',
    'replaced',
]

/** Every chain package runs this against its own history adapter. */
export const historyContractTests = (
    makeAdapter: () => HistoryChainAdapter,
    fixtures: HistoryContractFixtures,
): void => {
    const { scope, address, nativeAsset } = fixtures

    describe(`HistoryChainAdapter contract: ${makeAdapter().chainId}`, () => {
        beforeEach(() => {
            fixtures.arrangeTwoPages()
        })

        it("reads its own chain's scopes", () => {
            expect(makeAdapter().chainId).toBe(scope.chainId)
        })

        it('returns well-formed records for the requested scope', async () => {
            const { items } = await makeAdapter().getTransactionHistory(
                address,
                scope,
            )

            expect(items.length).toBeGreaterThan(0)
            for (const record of items) {
                expect(record.scope).toEqual(scope)
                expect(record.id).not.toBe('')
                expect(STATUSES).toContain(record.status)
                if (record.timestamp !== undefined) {
                    expect(record.timestamp).toBeGreaterThan(1e12)
                }
                if (record.fee !== undefined) {
                    expect(record.fee.isInteger()).toBe(true)
                    expect(record.fee.isNegative()).toBe(false)
                }
                expect(record.summary.title.key).not.toBe('')
                const { amount, balanceChanges } = record.summary
                if (amount) {
                    expect(amount.assetRef.chainId).toBe(scope.chainId)
                    expect(amount.value.isInteger()).toBe(true)
                }
                for (const change of balanceChanges ?? []) {
                    expect(change.assetRef.chainId).toBe(scope.chainId)
                    expect(change.value.isInteger()).toBe(true)
                }
            }
        })

        it('summarises a native transfer the address sent', async () => {
            const { items } = await makeAdapter().getTransactionHistory(
                address,
                scope,
            )

            const transfer = items.find(
                record => record.summary.kind === 'transfer',
            )
            expect(transfer?.summary.direction).toBe('out')
            expect(transfer?.summary.amount?.assetRef).toEqual(nativeAsset)
            expect(transfer?.summary.amount?.value.gt(0)).toBe(true)
        })

        it('pages through to the end without repeating a record', async () => {
            const adapter = makeAdapter()
            const first = await adapter.getTransactionHistory(address, scope)

            expect(first.next).toBeDefined()
            const second = await adapter.getTransactionHistory(
                address,
                scope,
                first.next,
            )

            expect(second.items.length).toBeGreaterThan(0)
            expect(second.next).toBeUndefined()
            const ids = [...first.items, ...second.items].map(r => r.id)
            expect(new Set(ids).size).toBe(ids.length)
        })

        it('returns an empty page for an account with no history', async () => {
            fixtures.arrangeEmpty()

            const page = await makeAdapter().getTransactionHistory(
                address,
                scope,
            )

            expect(page.items).toEqual([])
            expect(page.next).toBeUndefined()
        })

        it("refuses another chain's scope", async () => {
            await expect(
                makeAdapter().getTransactionHistory(address, {
                    ...scope,
                    chainId: 'not-this-chain' as ChainId,
                }),
            ).rejects.toThrow()
        })
    })
}
