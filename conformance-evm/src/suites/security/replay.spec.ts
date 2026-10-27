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
import { parseTransaction } from 'viem'
import type { Hex } from 'viem'
import { describe, expect, it } from 'vitest'
import type { UnsignedTransaction } from '@perawallet/wallet-core-chain-contract'
import {
    readEvmReviewTransaction,
    readEvmTransaction,
    type EthereumTransactionPayload,
} from '@perawallet/wallet-core-chain-ethereum/signing/adapter'
import { ethereumCallSummary } from '@perawallet/wallet-core-chain-ethereum/signing/review'
import { createEvmTransferAdapter } from '@perawallet/wallet-core-chain-ethereum/transfer/builder'

import {
    createRawKeyEvmAccount,
    fundEvmAccount,
    type EvmConformanceAccount,
} from '../../harness/accounts'
import { castDecodeTransaction } from '../../harness/cast'
import {
    createEvmConformanceSession,
    envFor,
    type EvmConformanceEnv,
} from '../../harness/context'
import { EVMNET, EVMNET_CHAINS, anvilRpc } from '../../harness/evmnet'
import { signTransactionWithApp } from '../../harness/sign'
import { broadcastAndConfirm, rejectionOf } from '../../harness/submit'

const buildTransfer = async (
    env: EvmConformanceEnv,
    from: EvmConformanceAccount,
    to: EvmConformanceAccount,
    wei: bigint,
): Promise<UnsignedTransaction> => {
    const [unsigned] = await createEvmTransferAdapter(
        env.ctx,
        env.evmChain,
    ).build(
        {
            kind: 'transfer',
            from: from.address,
            to: to.address,
            assetRef: env.evmChain.descriptor.nativeAsset.ref,
            amount: new Decimal(wei.toString()),
        },
        { scope: env.scope },
    )
    return unsigned
}

// Hand-built so every chain is covered: Base's transfer builder needs the OP
// GasPriceOracle predeploy, which the matrix does not depend on.
const handBuiltTransfer = (
    env: EvmConformanceEnv,
    from: EvmConformanceAccount,
    to: EvmConformanceAccount,
    wei: bigint,
): UnsignedTransaction => {
    const payload: EthereumTransactionPayload = {
        from: from.address,
        transaction: {
            type: 'eip1559',
            chainId: EVMNET[env.chain].eip155ChainId,
            nonce: 0,
            to: to.address,
            value: wei,
            gas: 21_000n,
            maxFeePerGas: 3_000_000_000n,
            maxPriorityFeePerGas: 1_000_000_000n,
        },
    }
    return {
        scope: env.scope,
        payload,
        summary: ethereumCallSummary(
            { from: from.address, to: to.address, value: wei, data: '0x' },
            env.evmChain,
        ),
        chainData: { family: 'evm' },
    }
}

/**
 * Proves a signature cannot be replayed across EVM chains: the app binds each
 * transaction to its chain's EIP-155 id, a real node on another chain refuses
 * the same bytes, and the reviewer refuses a transaction whose chain id is not
 * its scope's. Only a real node shows that the refusal is the node's, not a
 * mock's.
 */
describe('evm replay protection', () => {
    it('rejects an ethereum-signed transfer on the polygon node and accepts it on ethereum', async () => {
        const session = await createEvmConformanceSession()
        const ethereum = envFor(session, 'ethereum')
        const polygon = envFor(session, 'polygon')
        // The same key on both chains, so only the chain id differs.
        const sender = await createRawKeyEvmAccount(ethereum)
        const recipient = await createRawKeyEvmAccount(ethereum)
        await fundEvmAccount(ethereum, sender.address, 10n ** 18n)
        await fundEvmAccount(polygon, sender.address, 10n ** 18n)
        const raw = await signTransactionWithApp(
            ethereum,
            sender,
            await buildTransfer(ethereum, sender, recipient, 1000n),
        )
        expect(parseTransaction(raw).chainId).toBe(
            EVMNET.ethereum.eip155ChainId,
        )

        // Node acceptance: polygon's node refuses the exact bytes, by chain id.
        const rejection = await rejectionOf(() =>
            anvilRpc('polygon', 'eth_sendRawTransaction', [raw]),
        )
        expect((rejection as Error).message).toContain(
            'invalid chain id for signer',
        )
        expect((rejection as Error).message).toContain('-32003')

        // Nothing landed on polygon.
        expect(
            await anvilRpc<Hex>('polygon', 'eth_getTransactionCount', [
                sender.address,
                'latest',
            ]),
        ).toBe('0x0')

        // The same bytes are valid on the chain they were signed for.
        const { receipt } = await broadcastAndConfirm(ethereum, raw)
        expect(receipt.status).toBe('success')
        expect(receipt.from.toLowerCase()).toBe(sender.address.toLowerCase())
    })

    it('refuses to review or sign an unsigned transaction whose chainId is another chain', async () => {
        const session = await createEvmConformanceSession()
        const env = envFor(session, 'ethereum')
        const sender = await createRawKeyEvmAccount(env)
        const recipient = await createRawKeyEvmAccount(env)
        const built = await buildTransfer(env, sender, recipient, 1n)
        const payload = built.payload as EthereumTransactionPayload
        const foreign: UnsignedTransaction = {
            ...built,
            payload: {
                ...payload,
                transaction: {
                    ...payload.transaction,
                    chainId: EVMNET.polygon.eip155ChainId,
                },
            },
        }
        const refusal = `The transaction is for EIP-155 chain ${EVMNET.polygon.eip155ChainId}, not sepolia`

        expect(() => readEvmReviewTransaction(foreign, env.evmChain)).toThrow(
            refusal,
        )
        expect(() => readEvmTransaction(foreign, env.evmChain)).toThrow(refusal)
        await expect(
            signTransactionWithApp(env, sender, foreign),
        ).rejects.toThrow(refusal)
    })

    it.each(EVMNET_CHAINS)(
        "signs for %s with that chain's EIP-155 id and its node accepts it",
        async chain => {
            const session = await createEvmConformanceSession()
            const env = envFor(session, chain)
            const sender = await createRawKeyEvmAccount(env)
            const recipient = await createRawKeyEvmAccount(env)
            await fundEvmAccount(env, sender.address, 10n ** 18n)
            const raw = await signTransactionWithApp(
                env,
                sender,
                handBuiltTransfer(env, sender, recipient, 1000n),
            )

            expect(parseTransaction(raw).chainId).toBe(
                EVMNET[chain].eip155ChainId,
            )
            // Oracle parity: cast decodes the same chain id from the bytes.
            expect(Number((await castDecodeTransaction(raw)).chainId)).toBe(
                EVMNET[chain].eip155ChainId,
            )
            const { receipt } = await broadcastAndConfirm(env, raw)
            expect(receipt.status).toBe('success')
        },
    )
})
