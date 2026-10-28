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

import { Decimal } from 'decimal.js'
import {
    hexToBytes,
    keccak256,
    type Hex,
    type TransactionSerializedEIP1559,
} from 'viem'
import { describe, expect, it } from 'vitest'
import {
    EvmError,
    EvmErrorCode,
} from '@perawallet/wallet-core-chain-ethereum/blockchain/errors'
import { createEvmBroadcasterAdapter } from '@perawallet/wallet-core-chain-ethereum/transfer/broadcaster'
import {
    historyEntryOfSigned,
    submitEthereumTransactions,
} from '@perawallet/wallet-core-chain-ethereum/transfer/submission'
import {
    getOpenSubmissionAttempts,
    getSubmissionAttemptsWithHistoryEntry,
} from '@perawallet/wallet-core-signing'

import { createRawKeyEvmAccount, fundEvmAccount } from '../../harness/accounts'
import {
    createEvmConformanceEnv,
    type EvmConformanceEnv,
} from '../../harness/context'
import { anvilRpc, mine } from '../../harness/evmnet'
import { rejectionOf } from '../../harness/submit'
import {
    appClient,
    minedReceipt,
    pooledHashes,
    REVERTING_CALL_GAS,
    signedRevertingCall,
    signedTransfer,
    submitAndRecord,
    transactionOf,
    withPendingPool,
} from './support'

const RECIPIENT = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'
const AMOUNT = 12_345n

const setUp = async () => {
    const env = await createEvmConformanceEnv('ethereum')
    const sender = await createRawKeyEvmAccount(env)
    await fundEvmAccount(env, sender.address, 10n ** 18n)
    return { env, sender }
}

const submitBytes = (env: EvmConformanceEnv, raw: Hex) =>
    submitEthereumTransactions(appClient(env), [hexToBytes(raw)], env.evmChain)

/**
 * Proves the broadcaster against a real node's answers: a resend of pooled
 * bytes and a resend of mined bytes both read as accepted, a reverted receipt
 * fails the confirmation wait, and a recorded send leaves a ledger row that
 * holds its hash, nonce and history entry. The node's refusal strings are
 * pinned, since the app classifies by them and a mock would only echo what
 * the test assumed.
 */
describe('evm broadcast', () => {
    it('accepts a resend of bytes the node already pools, with the same hash', async () => {
        const { env, sender } = await setUp()
        const { raw } = await signedTransfer(env, sender, RECIPIENT, AMOUNT)

        await withPendingPool(env.chain, async () => {
            const [first] = await submitBytes(env, raw)
            expect(first).toBe(keccak256(raw))

            // Node acceptance: Anvil's wording for bytes it already pools.
            const nodeAnswer = await rejectionOf(() =>
                anvilRpc(env.chain, 'eth_sendRawTransaction', [raw]),
            )
            expect((nodeAnswer as Error).message).toContain(
                'JSON-RPC error -32003: transaction already imported',
            )

            expect(await submitBytes(env, raw)).toEqual([first])
            expect(await pooledHashes(env.chain)).toEqual([first.toLowerCase()])
            await mine(env.chain)
        })
    })

    it('accepts a resend of bytes already mined, which the node refuses as nonce too low', async () => {
        const { env, sender } = await setUp()
        const { raw } = await signedTransfer(env, sender, RECIPIENT, AMOUNT)
        const [hash] = await submitBytes(env, raw)
        expect((await minedReceipt(env.chain, hash as Hex)).status).toBe('0x1')

        // Node acceptance: the node's answer to the resend, after a response lost in transit.
        const nodeAnswer = await rejectionOf(() =>
            anvilRpc(env.chain, 'eth_sendRawTransaction', [raw]),
        )
        expect((nodeAnswer as Error).message).toContain(
            'JSON-RPC error -32003: nonce too low',
        )

        expect(await submitBytes(env, raw)).toEqual([hash])
    })

    it('fails the confirmation wait with REVERTED on a mined revert', async () => {
        const { env, sender } = await setUp()
        const raw = await signedRevertingCall(env, sender)
        expect(transactionOf(raw).gas).toBe(REVERTING_CALL_GAS)
        const broadcaster = createEvmBroadcasterAdapter(env.ctx, env.evmChain)

        const [hash] = await broadcaster.submit(env.scope, [hexToBytes(raw)])
        // Node acceptance: the node mined the call and recorded its failure.
        expect((await minedReceipt(env.chain, hash as Hex)).status).toBe('0x0')

        const failure = await rejectionOf(() =>
            broadcaster.waitForConfirmation(env.scope, [hash]),
        )
        expect(failure).toBeInstanceOf(EvmError)
        expect((failure as EvmError).code).toBe(EvmErrorCode.REVERTED)
    })

    it('records a ledger row with the hash, nonce, bytes and history entry before sending', async () => {
        const { env, sender } = await setUp()
        const { raw } = await signedTransfer(env, sender, RECIPIENT, AMOUNT)
        const { gas, maxFeePerGas } = transactionOf(raw)

        const hash = await submitAndRecord(env, raw)

        expect(hash).toBe(keccak256(raw))
        expect((await minedReceipt(env.chain, hash)).status).toBe('0x1')
        // Open until the reconciler reads the receipt.
        const [row, ...rest] = await getOpenSubmissionAttempts({
            db: env.db,
            scope: env.scope,
            sender: sender.address,
        })
        expect(rest).toEqual([])
        expect(row).toMatchObject({
            txIds: [hash],
            nonce: 0,
            sender: sender.address,
            flow: 'pipeline',
            status: 'submitted',
            rawTransaction: raw,
            replacesAttemptId: null,
        })
        const [withEntry] = await getSubmissionAttemptsWithHistoryEntry({
            db: env.db,
            scope: env.scope,
        })
        expect(withEntry.id).toBe(row.id)
        const { fee, ...entry } =
            withEntry.historyEntry as typeof withEntry.historyEntry & {
                fee?: Decimal
            }
        expect(entry).toEqual(
            await historyEntryOfSigned(
                raw as TransactionSerializedEIP1559,
                env.evmChain,
            ),
        )
        // Wei: the most the send can be charged, gas limit times fee cap.
        expect(fee?.toString()).toBe(
            new Decimal((gas! * maxFeePerGas!).toString()).toString(),
        )
    })
})
