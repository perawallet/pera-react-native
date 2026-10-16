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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import type {
    AssetRef,
    ChainScope,
    TransactionSummary,
} from '@perawallet/wallet-core-chain-contract'
import type { UnsyncedSubmissionSpend } from '@perawallet/wallet-core-signing'

const mocks = vi.hoisted(() => ({ getUnsyncedSubmissionSpends: vi.fn() }))

vi.mock('@perawallet/wallet-core-signing', () => ({
    getUnsyncedSubmissionSpends: mocks.getUnsyncedSubmissionSpends,
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    isSameAddress: (_chainId: string, a: string, b: string) =>
        a.toLowerCase() === b.toLowerCase(),
}))

import { getInFlightSpends } from '../in-flight'

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const ETH: AssetRef = { chainId: 'ethereum', assetId: 'native' }
const USDC: AssetRef = {
    chainId: 'ethereum',
    assetId: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
}
const SENDER = '0xAbC0000000000000000000000000000000000001'

const summary = (
    overrides: Partial<TransactionSummary> = {},
): TransactionSummary => ({
    kind: 'transfer',
    title: { key: 'transactions.list_item.send' },
    direction: 'out',
    icon: 'send',
    amount: { assetRef: ETH, value: new Decimal(100) },
    ...overrides,
})

const attempt = (
    overrides: Partial<UnsyncedSubmissionSpend> = {},
): UnsyncedSubmissionSpend => ({
    id: 'a',
    network: 'ethereum/mainnet',
    txIds: ['0x1'],
    intentKey: null,
    flow: 'pipeline',
    sender: SENDER,
    status: 'submitted',
    chainData: null,
    nonce: 3,
    createdAt: 0,
    resolvedAt: null,
    maxFee: new Decimal(30),
    historyEntry: { summary: summary(), chainData: { family: 'evm' } },
    ...overrides,
})

const read = () =>
    getInFlightSpends({ address: SENDER.toLowerCase(), scope: SCOPE })

describe('getInFlightSpends', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it("maps the account's open attempts, matching the sender through the chain's codec", async () => {
        mocks.getUnsyncedSubmissionSpends.mockResolvedValue([
            attempt(),
            attempt({
                id: 'other',
                sender: '0x0000000000000000000000000000000000000002',
            }),
            attempt({ id: 'unknown-sender', sender: null }),
        ])

        expect(await read()).toEqual([
            {
                nonce: 3,
                maxFee: new Decimal(30),
                outflows: [{ assetRef: ETH, value: new Decimal(100) }],
            },
        ])
        expect(mocks.getUnsyncedSubmissionSpends).toHaveBeenCalledWith({
            scope: SCOPE,
        })
    })

    it('counts a self-send but not an incoming or neutral amount', async () => {
        mocks.getUnsyncedSubmissionSpends.mockResolvedValue([
            attempt({
                historyEntry: {
                    summary: summary({ direction: 'self' }),
                    chainData: { family: 'evm' },
                },
            }),
            attempt({
                historyEntry: {
                    summary: summary({ direction: 'in' }),
                    chainData: { family: 'evm' },
                },
            }),
            attempt({
                historyEntry: {
                    summary: summary({ direction: 'none' }),
                    chainData: { family: 'evm' },
                },
            }),
        ])

        const spends = await read()

        expect(spends.map(spend => spend.outflows)).toEqual([
            [{ assetRef: ETH, value: new Decimal(100) }],
            [],
            [],
        ])
    })

    it('takes only what leaves the account from balance changes', async () => {
        mocks.getUnsyncedSubmissionSpends.mockResolvedValue([
            attempt({
                historyEntry: {
                    summary: summary({
                        kind: 'swap',
                        balanceChanges: [
                            { assetRef: ETH, value: new Decimal(-100) },
                            { assetRef: USDC, value: new Decimal(250) },
                        ],
                    }),
                    chainData: { family: 'evm' },
                },
            }),
        ])

        const [spend] = await read()

        expect(spend!.outflows).toEqual([
            { assetRef: ETH, value: new Decimal(100) },
        ])
    })

    it('keeps only the fee of an attempt with no entry, and leaves out what is unknown', async () => {
        mocks.getUnsyncedSubmissionSpends.mockResolvedValue([
            attempt({ historyEntry: null }),
            attempt({ historyEntry: null, maxFee: null, nonce: null }),
        ])

        expect(await read()).toEqual([
            { nonce: 3, maxFee: new Decimal(30), outflows: [] },
            { outflows: [] },
        ])
    })
})
