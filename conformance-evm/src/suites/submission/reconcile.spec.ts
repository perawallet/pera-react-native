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
import { createEvmClient } from '@perawallet/wallet-core-chain-ethereum/blockchain/utils/createEvmClient'
import {
    DROPPED_GRACE_MS,
    reconcileEthereumSubmissions,
    type SubmissionSettledHandlers,
} from '@perawallet/wallet-core-chain-ethereum/transfer/reconcile'
import type { SubmissionSettledHandler } from '@perawallet/wallet-core-signing'

import { createRawKeyEvmAccount, fundEvmAccount } from '../../harness/accounts'
import {
    createEvmConformanceEnv,
    type EvmConformanceEnv,
} from '../../harness/context'
import { anvilRpc, mine } from '../../harness/evmnet'
import {
    minedReceipt,
    nodeReceipt,
    nodeTransaction,
    pooledHashes,
    rowsAtNonce,
    signedReplacement,
    signedRevertingCall,
    signedTransfer,
    submitAndRecord,
    withPendingPool,
} from './support'

const RECIPIENT = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'
const AMOUNT = 4242n

const setUp = async () => {
    const env = await createEvmConformanceEnv('ethereum')
    const sender = await createRawKeyEvmAccount(env)
    await fundEvmAccount(env, sender.address, 10n ** 18n)
    const settled = vi.fn<SubmissionSettledHandler>()
    const handlers: SubmissionSettledHandlers = new Map([['pipeline', settled]])
    const reconcile = (limit?: number) =>
        reconcileEthereumSubmissions({
            chain: env.evmChain,
            settleHandlers: handlers,
            getClient: scope => createEvmClient(scope, env.ctx, env.evmChain),
            db: env.db,
            limit,
        })
    const statuses = async () =>
        (await rowsAtNonce(env, sender.address, 0)).map(row => row.status)
    return { env, sender, settled, reconcile, statuses }
}

// Only Date is faked: the RPC's own timers must keep running.
const afterGrace = async <T>(fn: () => Promise<T>): Promise<T> => {
    const now = Date.now()
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
        vi.setSystemTime(now + DROPPED_GRACE_MS + 1)
        return await fn()
    } finally {
        vi.useRealTimers()
    }
}

const dropFromPool = async (env: EvmConformanceEnv, hash: `0x${string}`) => {
    await anvilRpc(env.chain, 'anvil_dropTransaction', [hash])
    expect(await nodeTransaction(env.chain, hash)).toBeNull()
}

/**
 * Proves the reconciler settles the ledger from a real node's evidence: a
 * receipt confirms or fails, a nonce mined under another hash replaces, and
 * a transaction the node no longer holds fails only once the grace period
 * has passed and no newer sibling still waits at its nonce. Each verdict
 * rests on node state a mock would have to be told: receipts, the mined
 * nonce, and whether the node still holds a hash.
 */
describe('evm submission reconcile', () => {
    it('confirms a mined send', async () => {
        const { env, sender, settled, reconcile, statuses } = await setUp()
        const { raw } = await signedTransfer(env, sender, RECIPIENT, AMOUNT)
        const hash = await submitAndRecord(env, raw)
        expect((await minedReceipt(env.chain, hash)).status).toBe('0x1')

        expect(await reconcile()).toEqual({
            probed: 1,
            confirmed: 1,
            failed: 0,
        })
        expect(await statuses()).toEqual(['confirmed'])
        expect(settled).toHaveBeenCalledExactlyOnceWith(
            [hash],
            env.scope.networkId,
            'confirmed',
        )
    })

    it('fails a mined revert', async () => {
        const { env, sender, settled, reconcile, statuses } = await setUp()
        const hash = await submitAndRecord(
            env,
            await signedRevertingCall(env, sender),
        )
        expect((await minedReceipt(env.chain, hash)).status).toBe('0x0')

        expect(await reconcile()).toEqual({
            probed: 1,
            confirmed: 0,
            failed: 1,
        })
        expect(await statuses()).toEqual(['failed'])
        expect(settled).toHaveBeenCalledExactlyOnceWith(
            [hash],
            env.scope.networkId,
            'failed',
        )
    })

    it('settles a sped-up original as replaced and its replacement as confirmed', async () => {
        const { env, sender, settled, reconcile, statuses } = await setUp()

        const { originalHash, replacementHash } = await withPendingPool(
            env.chain,
            async () => {
                const original = await signedTransfer(
                    env,
                    sender,
                    RECIPIENT,
                    AMOUNT,
                )
                const originalHash = await submitAndRecord(env, original.raw)
                const replacementHash = await submitAndRecord(
                    env,
                    (
                        await signedReplacement(
                            env,
                            sender,
                            'speed-up',
                            original.raw,
                        )
                    ).raw,
                )
                await mine(env.chain)
                return { originalHash, replacementHash }
            },
        )
        expect(await nodeReceipt(env.chain, originalHash)).toBeNull()

        expect(await reconcile()).toEqual({
            probed: 2,
            confirmed: 1,
            failed: 1,
        })
        expect(await statuses()).toEqual(['replaced', 'confirmed'])
        expect(settled).toHaveBeenCalledWith(
            [originalHash],
            env.scope.networkId,
            'failed',
        )
        expect(settled).toHaveBeenCalledWith(
            [replacementHash],
            env.scope.networkId,
            'confirmed',
        )
    })

    it('fails a dropped send only once the grace period has passed', async () => {
        const { env, sender, settled, reconcile, statuses } = await setUp()

        await withPendingPool(env.chain, async () => {
            const { raw } = await signedTransfer(env, sender, RECIPIENT, AMOUNT)
            const hash = await submitAndRecord(env, raw)
            await dropFromPool(env, hash)

            // Within grace an unknown hash may be a load-balanced RPC lagging, so the row stays open.
            expect(await reconcile()).toEqual({
                probed: 1,
                confirmed: 0,
                failed: 0,
            })
            expect(await statuses()).toEqual(['submitted'])

            expect(await afterGrace(reconcile)).toEqual({
                probed: 1,
                confirmed: 0,
                failed: 1,
            })
            expect(await statuses()).toEqual(['failed'])
            expect(settled).toHaveBeenCalledExactlyOnceWith(
                [hash],
                env.scope.networkId,
                'failed',
            )
            expect(await pooledHashes(env.chain)).toEqual([])
        })
    })

    it('keeps a dropped original open while its newer replacement waits at the nonce', async () => {
        const { env, sender, reconcile, statuses } = await setUp()

        await withPendingPool(env.chain, async () => {
            const original = await signedTransfer(
                env,
                sender,
                RECIPIENT,
                AMOUNT,
            )
            await submitAndRecord(env, original.raw)
            const replacementHash = await submitAndRecord(
                env,
                (await signedReplacement(env, sender, 'speed-up', original.raw))
                    .raw,
            )
            // The node evicted the original on the replacement; dropping the
            // replacement too leaves the nonce with nothing pooled.
            await dropFromPool(env, replacementHash)
            expect(await pooledHashes(env.chain)).toEqual([])

            // Oldest first, so a one-row pass probes the original alone.
            expect(await afterGrace(() => reconcile(1))).toEqual({
                probed: 1,
                confirmed: 0,
                failed: 0,
            })
            expect(await statuses()).toEqual(['submitted', 'submitted'])

            // Once the replacement fails, nothing newer holds the nonce.
            await afterGrace(() => reconcile())
            await afterGrace(() => reconcile())
            expect(await statuses()).toEqual(['failed', 'failed'])
        })
    })
})
