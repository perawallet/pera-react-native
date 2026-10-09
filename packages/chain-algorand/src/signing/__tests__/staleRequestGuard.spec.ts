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

import { describe, expect, it, vi } from 'vitest'
import { Address, assignGroupID, Transaction, TransactionType } from 'algosdk'
import type { PeraTransaction } from '@perawallet/wallet-core-chain-contract'
import { decodeFromBase64 } from '@perawallet/wallet-core-shared'
import type { SignRequest } from '@perawallet/wallet-core-signing'
import { getExpectedGenesisHash } from '../../blockchain'
import { makeUnsignedAlgorandTransaction } from './transactions'
import {
    findStaleGroupReason,
    partitionByGroup,
    staleReasonFor,
    type SimulateOriginalGroup,
} from '../staleRequestGuard'

const SENDER = new Address(new Uint8Array(32).fill(1))
const RECEIVER = new Address(new Uint8Array(32).fill(2))

const payment = (
    amount: bigint,
    genesisHash = decodeFromBase64(getExpectedGenesisHash('mainnet')),
): Transaction =>
    new Transaction({
        type: TransactionType.pay,
        sender: SENDER,
        paymentParams: { receiver: RECEIVER, amount },
        suggestedParams: {
            fee: 1000n,
            minFee: 1000n,
            flatFee: true,
            firstValid: 1000n,
            lastValid: 2000n,
            genesisID: 'mainnet-v1.0',
            genesisHash,
        },
    })

const grouped = (...txns: Transaction[]): Transaction[] => assignGroupID(txns)

const asPera = (txns: Transaction[]) => txns as unknown as PeraTransaction[]

const makeRequest = (groupContext: Transaction[]): SignRequest =>
    ({
        id: 'req-1',
        type: 'transactions',
        transport: 'callback',
        sourceType: 'walletconnect',
        txs: asPera(groupContext.slice(0, 1)),
        groupContext: asPera(groupContext),
    }) as SignRequest

const alreadyInLedger = (txn: Transaction) =>
    `transaction already in ledger: ${txn.txID()}`

const DEAD = 'txn dead: round 2500 outside of 1000--2000'

describe('partitionByGroup', () => {
    it('splits a request into its atomic groups and lone transactions', () => {
        const first = grouped(payment(1n), payment(2n))
        const lone = payment(3n)
        const second = grouped(payment(4n), payment(5n))

        const partitions = partitionByGroup(asPera([...first, lone, ...second]))

        expect(partitions.map(group => group.length)).toEqual([2, 1, 2])
    })
})

describe('staleReasonFor', () => {
    it('is already on chain when algod holds one of the group’s own transactions', () => {
        const group = grouped(payment(1n), payment(2n))

        expect(staleReasonFor(alreadyInLedger(group[1]), asPera(group))).toBe(
            'already-on-chain',
        )
    })

    it('ignores a duplicate that is not one of the group’s transactions', () => {
        const group = grouped(payment(1n), payment(2n))

        expect(
            staleReasonFor(alreadyInLedger(payment(9n)), asPera(group)),
        ).toBeNull()
    })

    it.each([
        ['one dash', 'txn dead: round 2500 outside of 1000-2000'],
        ['two dashes', DEAD],
    ])('is expired past the last valid round (%s)', (_label, message) => {
        expect(staleReasonFor(message, asPera([payment(1n)]))).toBe('expired')
    })

    it('is live while the first valid round is still ahead', () => {
        expect(
            staleReasonFor(
                'txn dead: round 500 outside of 1000--2000',
                asPera([payment(1n)]),
            ),
        ).toBeNull()
    })

    it('is live for any other failure', () => {
        expect(
            staleReasonFor(
                'logic eval error: assert failed pc=12. Details: app=3732791636, pc=12',
                asPera([payment(1n)]),
            ),
        ).toBeNull()
    })
})

describe('findStaleGroupReason', () => {
    const run = (request: SignRequest, simulate: SimulateOriginalGroup) =>
        findStaleGroupReason(request, { simulate, network: 'mainnet' })

    it('never simulates a chain-neutral request', async () => {
        const simulate = vi.fn<SimulateOriginalGroup>()
        const request = {
            id: 'req-neutral',
            type: 'transactions',
            transport: 'algod',
            txs: [makeUnsignedAlgorandTransaction()],
        } as SignRequest

        await expect(run(request, simulate)).resolves.toBeNull()
        expect(simulate).not.toHaveBeenCalled()
    })

    it('simulates each original group with its group id intact', async () => {
        const first = grouped(payment(1n), payment(2n))
        const second = grouped(payment(3n), payment(4n))
        const simulate = vi.fn<SimulateOriginalGroup>(async group =>
            alreadyInLedger(group[0] as unknown as Transaction),
        )

        await run(makeRequest([...first, ...second]), simulate)

        expect(simulate).toHaveBeenCalledTimes(2)
        expect(simulate.mock.calls[0][0]).toEqual(asPera(first))
        expect(simulate.mock.calls[1][0]).toEqual(asPera(second))
    })

    it('is already on chain when every group is', async () => {
        const group = grouped(payment(1n), payment(2n))

        await expect(
            run(makeRequest(group), async () => alreadyInLedger(group[0])),
        ).resolves.toBe('already-on-chain')
    })

    it('reports already-on-chain over expired when the groups differ', async () => {
        const first = grouped(payment(1n), payment(2n))
        const second = grouped(payment(3n), payment(4n))
        const simulate: SimulateOriginalGroup = async group =>
            group[0] === (first[0] as unknown as PeraTransaction)
                ? DEAD
                : alreadyInLedger(second[0])

        await expect(
            run(makeRequest([...first, ...second]), simulate),
        ).resolves.toBe('already-on-chain')
    })

    it('is live when any group can still land, and stops at the first live group', async () => {
        const first = grouped(payment(1n), payment(2n))
        const second = grouped(payment(3n), payment(4n))
        const simulate = vi.fn<SimulateOriginalGroup>(async () => null)

        await expect(
            run(makeRequest([...first, ...second]), simulate),
        ).resolves.toBeNull()
        expect(simulate).toHaveBeenCalledTimes(1)
    })

    it('is live when a later group can still land', async () => {
        const first = grouped(payment(1n), payment(2n))
        const second = grouped(payment(3n), payment(4n))
        const simulate: SimulateOriginalGroup = async group =>
            group[0] === (first[0] as unknown as PeraTransaction)
                ? alreadyInLedger(first[0])
                : null

        await expect(
            run(makeRequest([...first, ...second]), simulate),
        ).resolves.toBeNull()
    })

    it('leaves a transaction from another network to the analyzer', async () => {
        // Its rounds can read as "txn dead" here, but the honest answer is
        // the network-mismatch error the analyzer raises.
        const foreign = payment(1n, new Uint8Array(32).fill(0xab))
        const simulate = vi.fn<SimulateOriginalGroup>(async () => DEAD)

        await expect(run(makeRequest([foreign]), simulate)).resolves.toBeNull()
        expect(simulate).not.toHaveBeenCalled()
    })

    it('is live when algod does not answer in time', async () => {
        await expect(
            findStaleGroupReason(makeRequest([payment(1n)]), {
                simulate: () => new Promise<never>(() => {}),
                network: 'mainnet',
                timeoutMs: 5,
            }),
        ).resolves.toBeNull()
    })

    it('is live when the simulation call fails', async () => {
        await expect(
            run(makeRequest([payment(1n)]), async () => {
                throw new Error('Network request failed')
            }),
        ).resolves.toBeNull()
    })

    it('never simulates a request that carries no transactions', async () => {
        const simulate = vi.fn<SimulateOriginalGroup>(async () => DEAD)

        await expect(
            run(
                {
                    ...makeRequest([]),
                    type: 'arbitrary-data',
                    data: [],
                } as never,
                simulate,
            ),
        ).resolves.toBeNull()
        expect(simulate).not.toHaveBeenCalled()
    })
})
