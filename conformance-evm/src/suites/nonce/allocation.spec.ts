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

import { hexToBytes, type Hex } from 'viem'
import { describe, expect, it } from 'vitest'
import type { EthereumTransactionPayload } from '@perawallet/wallet-core-chain-ethereum/signing/adapter'
import { EvmErrorCode } from '@perawallet/wallet-core-chain-ethereum/blockchain/errors'
import { allocateEthereumNonce } from '@perawallet/wallet-core-chain-ethereum/transfer/nonce-pool'
import { submitEthereumTransactions } from '@perawallet/wallet-core-chain-ethereum/transfer/submission'
import {
    resolveSubmissionAttempt,
    SubmissionError,
} from '@perawallet/wallet-core-signing'

import {
    createRawKeyEvmAccount,
    fundEvmAccount,
    nativeBalanceOf,
} from '../../harness/accounts'
import { expectEvmConformant } from '../../harness/assert/roundTrip'
import { createEvmConformanceEnv } from '../../harness/context'
import { EVMNET, anvilRpc, mine } from '../../harness/evmnet'
import { rejectionOf } from '../../harness/submit'
import {
    appClient,
    chargedFee,
    nodeReceipt,
    nodeTransaction,
    pooledHashes,
    rowsAtNonce,
    signedTransfer,
    submitAndRecord,
    transactionOf,
    withPendingPool,
} from '../submission/support'

const RECIPIENT = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'
const OTHER_RECIPIENT = '0x90F79bf6EB2c4f870365E785982E1f101E93b906'

const setUp = async () => {
    const env = await createEvmConformanceEnv('ethereum')
    const sender = await createRawKeyEvmAccount(env)
    await fundEvmAccount(env, sender.address, 10n ** 18n)
    const allocate = () =>
        allocateEthereumNonce({
            client: appClient(env),
            scope: env.scope,
            sender: sender.address,
            db: env.db,
        })
    return { env, sender, allocate }
}

/**
 * Proves the nonce pool against a node's pending pool: consecutive recorded
 * sends take consecutive nonces and all mine, a dropped send's open ledger
 * row keeps its nonce held until it is settled `failed`, and a second send at
 * a held nonce is refused before the node sees it. Only a real mempool shows
 * the node's pending count moving with the pool and falling back on a drop.
 */
describe('evm nonce allocation', () => {
    it('allocates n, n+1, n+2 across recorded sends and all three mine', async () => {
        const { env, sender, allocate } = await setUp()
        const values = [1n, 2n, 3n]
        const senderBefore = await nativeBalanceOf(env, sender.address)
        const recipientBefore = await nativeBalanceOf(env, RECIPIENT)

        const sent = await withPendingPool(env.chain, async () => {
            const out: { raw: Hex; hash: Hex }[] = []
            for (const [expected, value] of values.entries()) {
                expect(await allocate()).toBe(expected)
                const { raw } = await signedTransfer(
                    env,
                    sender,
                    RECIPIENT,
                    value,
                )
                // The builder allocates through the same pool.
                expect(transactionOf(raw).nonce).toBe(expected)
                out.push({ raw, hash: await submitAndRecord(env, raw) })
            }
            expect(await allocate()).toBe(values.length)
            await mine(env.chain)
            return out
        })

        let fees = 0n
        for (const [nonce, { raw, hash }] of sent.entries()) {
            const app = transactionOf(raw)
            // Round-trip: gas and fee caps are the app's choice; the rest is declared here.
            await expectEvmConformant({
                env,
                intent: {
                    chainId: EVMNET.ethereum.eip155ChainId,
                    from: sender.address,
                    nonce,
                    to: RECIPIENT,
                    value: values[nonce],
                    gas: app.gas!,
                    maxFeePerGas: app.maxFeePerGas!,
                    maxPriorityFeePerGas: app.maxPriorityFeePerGas!,
                },
                raw,
                hash,
                isBalanceAssertedByCaller: true,
            })
            fees += await chargedFee(env.chain, hash)
        }
        const total = values.reduce((sum, value) => sum + value, 0n)
        expect(
            senderBefore - (await nativeBalanceOf(env, sender.address)),
        ).toBe(total + fees)
        expect((await nativeBalanceOf(env, RECIPIENT)) - recipientBefore).toBe(
            total,
        )
        expect(
            (await rowsAtNonce(env, sender.address, 2)).map(row => row.txIds),
        ).toEqual([[sent[2].hash]])
    })

    it('holds a dropped send’s nonce until its row is settled failed, then reuses it', async () => {
        const { env, sender, allocate } = await setUp()

        await withPendingPool(env.chain, async () => {
            const { raw } = await signedTransfer(env, sender, RECIPIENT, 1n)
            const dropped = await submitAndRecord(env, raw)
            await anvilRpc(env.chain, 'anvil_dropTransaction', [dropped])

            // The node has forgotten it; only the ledger still holds nonce 0.
            expect(
                await appClient(env).getTransactionCount({
                    address: sender.address,
                    blockTag: 'pending',
                }),
            ).toBe(0)
            expect(await nodeTransaction(env.chain, dropped)).toBeNull()
            expect(await allocate()).toBe(1)

            const [row] = await rowsAtNonce(env, sender.address, 0)
            await resolveSubmissionAttempt({
                db: env.db,
                id: row.id,
                status: 'failed',
            })
            expect(await allocate()).toBe(0)

            const refill = await signedTransfer(env, sender, RECIPIENT, 2n)
            expect(transactionOf(refill.raw).nonce).toBe(0)
            const refilled = await submitAndRecord(env, refill.raw)
            await mine(env.chain)

            expect((await nodeReceipt(env.chain, refilled))?.status).toBe('0x1')
            expect(await nodeReceipt(env.chain, dropped)).toBeNull()
        })
    })

    it('refuses a second send at an open row’s nonce before the node sees it', async () => {
        const { env, sender } = await setUp()

        await withPendingPool(env.chain, async () => {
            // Both built before either is recorded, so both read nonce 0.
            const first = await signedTransfer(env, sender, RECIPIENT, 1n)
            const second = await signedTransfer(
                env,
                sender,
                OTHER_RECIPIENT,
                2n,
            )
            const secondPayload = second.unsigned
                .payload as EthereumTransactionPayload
            expect(secondPayload.transaction.nonce).toBe(0)
            const firstHash = await submitAndRecord(env, first.raw)

            const refusal = await rejectionOf(() =>
                submitAndRecord(env, second.raw),
            )
            expect(refusal).toBeInstanceOf(SubmissionError)
            expect(refusal).toMatchObject({
                classification: 'rejected-by-node',
                nodeError: { code: EvmErrorCode.NONCE_TOO_LOW },
            })
            // Never broadcast and never recorded: the pool and the ledger hold the first alone.
            expect(await pooledHashes(env.chain)).toEqual([
                firstHash.toLowerCase(),
            ])
            expect(
                (await rowsAtNonce(env, sender.address, 0)).map(
                    row => row.txIds,
                ),
            ).toEqual([[firstHash]])

            await mine(env.chain)
            expect((await nodeReceipt(env.chain, firstHash))?.status).toBe(
                '0x1',
            )

            // Node acceptance: with nonce 0 mined, the node's own refusal of the same bytes.
            const nodeRefusal = await rejectionOf(() =>
                anvilRpc(env.chain, 'eth_sendRawTransaction', [second.raw]),
            )
            expect((nodeRefusal as Error).message).toContain(
                'JSON-RPC error -32003: nonce too low',
            )
            const appRefusal = await rejectionOf(() =>
                submitEthereumTransactions(
                    appClient(env),
                    [hexToBytes(second.raw)],
                    env.evmChain,
                ),
            )
            expect(appRefusal).toMatchObject({
                classification: 'rejected-by-node',
                nodeError: { code: EvmErrorCode.NONCE_TOO_LOW },
            })
        })
    })
})
