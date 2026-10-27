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
    parseTransaction,
    serializeTransaction,
} from 'viem'
import type { Hex } from 'viem'
import { describe, expect, it } from 'vitest'
import type { UnsignedTransaction } from '@perawallet/wallet-core-chain-contract'
import type { EthereumTransactionPayload } from '@perawallet/wallet-core-chain-ethereum/signing/adapter'
import { createEvmPlannerAdapter } from '@perawallet/wallet-core-chain-ethereum/signing/adapter'
import { createEvmTransferAdapter } from '@perawallet/wallet-core-chain-ethereum/transfer/builder'

import {
    createRawKeyEvmAccount,
    fundEvmAccount,
    type EvmConformanceAccount,
} from '../../harness/accounts'
import { expectEvmConformant } from '../../harness/assert/roundTrip'
import { ANVIL_DEV_PRIVATE_KEY, castMktx, castSend } from '../../harness/cast'
import { deployContract } from '../../harness/contracts'
import {
    createEvmConformanceEnv,
    type EvmConformanceEnv,
} from '../../harness/context'
import { signTransactionWithApp } from '../../harness/sign'
import { broadcastAndConfirm } from '../../harness/submit'

const ORDER = BigInt(
    '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141',
)
const HALF_ORDER = ORDER / 2n

const payloadOf = (unsigned: UnsignedTransaction) => {
    const { transaction } = unsigned.payload as EthereumTransactionPayload
    return {
        nonce: transaction.nonce!,
        to: transaction.to!,
        value: transaction.value ?? 0n,
        data: transaction.data,
        gas: transaction.gas!,
        maxFeePerGas: transaction.maxFeePerGas!,
        maxPriorityFeePerGas: transaction.maxPriorityFeePerGas!,
        chainId: transaction.chainId!,
        transaction,
    }
}

const setup = async (): Promise<{
    env: EvmConformanceEnv
    sender: EvmConformanceAccount
    recipient: EvmConformanceAccount
}> => {
    const env = await createEvmConformanceEnv('ethereum')
    const sender = await createRawKeyEvmAccount(env)
    const recipient = await createRawKeyEvmAccount(env)
    await fundEvmAccount(env, sender.address, 10n ** 18n)
    return { env, sender, recipient }
}

/**
 * Proves that what the app signs for a built native and ERC-20 transfer is
 * byte-identical to what cast signs for the same fields, that the node accepts
 * and attributes it to the sender, and that the signature is canonical. A
 * mocked signer can't show any of these, since all three depend on a real
 * secp256k1 nonce and a real recovery.
 */
describe('evm transaction signing conformance', () => {
    const proveSigned = async (
        env: EvmConformanceEnv,
        sender: EvmConformanceAccount,
        unsigned: UnsignedTransaction,
    ): Promise<{ raw: Hex; hash: Hex }> => {
        const fields = payloadOf(unsigned)
        const raw = await signTransactionWithApp(env, sender, unsigned)

        // Oracle parity: cast signs the identical fields to the identical bytes.
        const oracleRaw = await castMktx({
            privateKey: sender.privateKey,
            chainId: fields.chainId,
            nonce: fields.nonce,
            to: fields.to,
            value: fields.value,
            ...(fields.data !== undefined && { data: fields.data }),
            gas: fields.gas,
            maxFeePerGas: fields.maxFeePerGas,
            maxPriorityFeePerGas: fields.maxPriorityFeePerGas,
        })
        expect(raw).toEqual(oracleRaw)

        const parsed = parseTransaction(raw)
        expect(parsed.type).toBe('eip1559')
        const { r, s, yParity } = parsed as {
            r: Hex
            s: Hex
            yParity: number
        }
        expect(BigInt(s)).toBeLessThanOrEqual(HALF_ORDER)
        expect(BigInt(r)).toBeGreaterThan(0n)
        expect([0, 1]).toContain(yParity)

        // The planner's payload is the keccak of the unsigned serialization.
        const [planned] = createEvmPlannerAdapter(env.evmChain).plan(unsigned)
        expect(planned.payload).toEqual(
            hexToBytes(
                keccak256(
                    serializeTransaction({
                        ...fields.transaction,
                        type: 'eip1559',
                    }),
                ),
            ),
        )

        const { hash } = await broadcastAndConfirm(env, raw)
        return { raw, hash }
    }

    it('signs a native transfer identically to cast and the node accepts it', async () => {
        const { env, sender, recipient } = await setup()
        const wei = 123_456_789_012_345_678n
        const [unsigned] = await createEvmTransferAdapter(
            env.ctx,
            env.evmChain,
        ).build(
            {
                kind: 'transfer',
                from: sender.address,
                to: recipient.address,
                assetRef: env.evmChain.descriptor.nativeAsset.ref,
                amount: new Decimal(wei.toString()),
            },
            { scope: env.scope },
        )
        const fields = payloadOf(unsigned)

        const { raw, hash } = await proveSigned(env, sender, unsigned)

        // Round-trip: the node holds what the app declared.
        await expectEvmConformant({
            env,
            intent: {
                chainId: fields.chainId,
                from: sender.address,
                nonce: fields.nonce,
                to: recipient.address,
                value: wei,
                gas: fields.gas,
                maxFeePerGas: fields.maxFeePerGas,
                maxPriorityFeePerGas: fields.maxPriorityFeePerGas,
            },
            raw,
            hash,
        })
    })

    it('signs an ERC-20 transfer identically to cast and the node accepts it', async () => {
        const { env, sender, recipient } = await setup()
        const token = await deployContract(
            env.chain,
            'TestToken',
            ['Conformance Token', 'CFT', (10n ** 30n).toString()],
            'constructor(string,string,uint256)',
        )
        // Above 2^53, so a number-typed amount would corrupt it.
        const amount = 9_007_199_254_740_993n * 1000n
        await castSend({
            chain: env.chain,
            privateKey: ANVIL_DEV_PRIVATE_KEY,
            to: token,
            sig: 'transfer(address,uint256)',
            args: [sender.address, (amount * 2n).toString()],
        })

        const [unsigned] = await createEvmTransferAdapter(
            env.ctx,
            env.evmChain,
        ).build(
            {
                kind: 'transfer',
                from: sender.address,
                to: recipient.address,
                assetRef: { chainId: env.chain, assetId: token },
                amount: new Decimal(amount.toString()),
            },
            { scope: env.scope },
        )
        const fields = payloadOf(unsigned)
        expect(fields.to.toLowerCase()).toBe(token.toLowerCase())
        expect(fields.value).toBe(0n)

        const { raw, hash } = await proveSigned(env, sender, unsigned)

        // Round-trip: calldata is the ERC-20 transfer to the recipient.
        await expectEvmConformant({
            env,
            intent: {
                chainId: fields.chainId,
                from: sender.address,
                nonce: fields.nonce,
                to: token,
                data: fields.data!,
                gas: fields.gas,
                maxFeePerGas: fields.maxFeePerGas,
                maxPriorityFeePerGas: fields.maxPriorityFeePerGas,
            },
            raw,
            hash,
        })
    })
})
