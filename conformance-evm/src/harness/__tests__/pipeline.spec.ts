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
import { hexToBytes, type Address } from 'viem'
import { describe, expect, it } from 'vitest'
import type { EthereumTransactionPayload } from '@perawallet/wallet-core-chain-ethereum/signing/adapter'
import { createEvmBroadcasterAdapter } from '@perawallet/wallet-core-chain-ethereum/transfer/broadcaster'
import { createEvmTransferAdapter } from '@perawallet/wallet-core-chain-ethereum/transfer/builder'

import {
    createHdEvmAccount,
    createRawKeyEvmAccount,
    fundEvmAccount,
    nativeBalanceOf,
    type EvmConformanceAccount,
} from '../accounts'
import { expectEvmConformant } from '../assert/roundTrip'
import type { EvmTxnIntent } from '../assert/intent'
import { createEvmConformanceEnv, type EvmConformanceEnv } from '../context'
import { EVMNET, mine, withAutomineOff } from '../evmnet'
import { signTransactionWithApp } from '../sign'
import { broadcastAndConfirm, rejectionOf } from '../submit'

const ONE_ETHER = 10n ** 18n
const TENTH_ETHER = ONE_ETHER / 10n

const buildAndSign = async (
    env: EvmConformanceEnv,
    sender: EvmConformanceAccount,
    to: Address,
    wei: bigint,
) => {
    const [unsigned] = await createEvmTransferAdapter(
        env.ctx,
        env.evmChain,
    ).build(
        {
            kind: 'transfer',
            from: sender.address,
            to,
            assetRef: env.evmChain.descriptor.nativeAsset.ref,
            amount: new Decimal(wei.toString()),
        },
        { scope: env.scope },
    )
    const { transaction } = unsigned.payload as EthereumTransactionPayload
    const intent: EvmTxnIntent = {
        chainId: EVMNET[env.chain].eip155ChainId,
        from: sender.address,
        nonce: transaction.nonce!,
        to,
        value: wei,
        gas: transaction.gas!,
        maxFeePerGas: transaction.maxFeePerGas!,
        maxPriorityFeePerGas: transaction.maxPriorityFeePerGas!,
    }
    return { intent, raw: await signTransactionWithApp(env, sender, unsigned) }
}

describe('the app pipeline against evmnet', () => {
    it('builds, signs and broadcasts a native transfer the node confirms as declared', async () => {
        const env = await createEvmConformanceEnv('ethereum')
        const sender = await createHdEvmAccount(env)
        const recipient = await createRawKeyEvmAccount(env)
        await fundEvmAccount(env, sender.address, ONE_ETHER)

        const [unsigned] = await createEvmTransferAdapter(
            env.ctx,
            env.evmChain,
        ).build(
            {
                kind: 'transfer',
                from: sender.address,
                to: recipient.address,
                assetRef: env.evmChain.descriptor.nativeAsset.ref,
                amount: new Decimal(TENTH_ETHER.toString()),
            },
            { scope: env.scope },
        )
        // Gas and fees are the app's own quote; the intent pins everything else.
        const { transaction } = unsigned.payload as EthereumTransactionPayload

        const raw = await signTransactionWithApp(env, sender, unsigned)
        const { hash } = await broadcastAndConfirm(env, raw)
        const receipt = await expectEvmConformant({
            env,
            intent: {
                chainId: EVMNET.ethereum.eip155ChainId,
                from: sender.address,
                nonce: 0,
                to: recipient.address,
                value: TENTH_ETHER,
                gas: transaction.gas!,
                maxFeePerGas: transaction.maxFeePerGas!,
                maxPriorityFeePerGas: transaction.maxPriorityFeePerGas!,
            },
            raw,
            hash,
        })

        expect(receipt.transactionHash).toBe(hash)
        expect(await nativeBalanceOf(env, recipient.address)).toBe(TENTH_ETHER)
    })

    it('attributes a balance change only to a transaction alone in its block for the sender', async () => {
        const env = await createEvmConformanceEnv('ethereum')
        const sender = await createHdEvmAccount(env)
        const recipient = await createRawKeyEvmAccount(env)
        await fundEvmAccount(env, sender.address, ONE_ETHER)
        const broadcaster = createEvmBroadcasterAdapter(env.ctx, env.evmChain)

        // Built one after the other so the second reads the first's pending nonce.
        const sent = await withAutomineOff('ethereum', async () => {
            const first = await buildAndSign(env, sender, recipient.address, 1n)
            const [firstHash] = await broadcaster.submit(env.scope, [
                hexToBytes(first.raw),
            ])
            const second = await buildAndSign(
                env,
                sender,
                recipient.address,
                2n,
            )
            await broadcaster.submit(env.scope, [hexToBytes(second.raw)])
            await mine('ethereum')
            return { ...first, hash: firstHash as `0x${string}` }
        })

        await expect(expectEvmConformant({ env, ...sent })).rejects.toThrow(
            /also holds 0x[0-9a-f]{64}, which move the sender's balance/,
        )
        await expect(
            expectEvmConformant({
                env,
                ...sent,
                isBalanceAssertedByCaller: true,
            }),
        ).resolves.toMatchObject({ status: 'success' })
    })

    it('refuses to waive the balance check for a transaction alone in its block', async () => {
        const env = await createEvmConformanceEnv('ethereum')
        const sender = await createHdEvmAccount(env)
        const recipient = await createRawKeyEvmAccount(env)
        await fundEvmAccount(env, sender.address, ONE_ETHER)
        const { intent, raw } = await buildAndSign(
            env,
            sender,
            recipient.address,
            1n,
        )
        const { hash } = await broadcastAndConfirm(env, raw)

        await expect(
            expectEvmConformant({
                env,
                intent,
                raw,
                hash,
                isBalanceAssertedByCaller: true,
            }),
        ).rejects.toThrow(/drop isBalanceAssertedByCaller/)
    })

    it('reports what a rejection threw, and refuses a promise that resolved', async () => {
        const failure = new Error('refused')

        expect(await rejectionOf(() => Promise.reject(failure))).toBe(failure)
        await expect(rejectionOf(() => Promise.resolve(1))).rejects.toThrow(
            /expected a rejection/,
        )
    })
})
