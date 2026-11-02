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
import type { Hex } from 'viem'
import { describe, expect, it } from 'vitest'
import { fetchAndPersistAccount } from '@perawallet/wallet-core-accounts'
import { EvmErrorCode } from '@perawallet/wallet-core-chain-ethereum/blockchain/errors'
import { createEvmTransferAdapter } from '@perawallet/wallet-core-chain-ethereum/transfer/builder'

import {
    createRawKeyEvmAccount,
    fundEvmAccount,
    nativeBalanceOf,
} from '../../harness/accounts'
import { oracleOpStackFees } from '../../harness/contracts'
import {
    createEvmConformanceEnv,
    type EvmConformanceEnv,
} from '../../harness/context'
import { EVMNET, anvilRpc, type EvmnetChain } from '../../harness/evmnet'
import { buildTransfer, expectEvmConformant, signAndSend } from './support'

const FUNDED = 10n ** 18n + 123_456_789n

const nextBaseFeeOf = async (env: EvmConformanceEnv): Promise<bigint> => {
    const history = await anvilRpc<{ baseFeePerGas: Hex[] }>(
        env.chain,
        'eth_feeHistory',
        ['0x1', 'latest', []],
    )
    return BigInt(history.baseFeePerGas.at(-1)!)
}

const setNextBaseFee = (env: EvmConformanceEnv, wei: bigint) =>
    anvilRpc(env.chain, 'anvil_setNextBlockBaseFeePerGas', [
        `0x${wei.toString(16)}`,
    ])

/** A funded sender, a recipient and the normal speed's quote, as the send screen holds them before MAX. */
const quoteMaxSend = async (chain: EvmnetChain) => {
    const env = await createEvmConformanceEnv(chain)
    const sender = await createRawKeyEvmAccount(env)
    const recipient = await createRawKeyEvmAccount(env)
    await fundEvmAccount(env, sender.address, FUNDED)
    // The spendable balance reads the synced store, as the send screen does.
    await fetchAndPersistAccount(sender.address, env.scope)

    const adapter = createEvmTransferAdapter(env.ctx, env.evmChain)
    const nativeRef = env.evmChain.descriptor.nativeAsset.ref
    const estimate = await adapter.getFeeEstimate(
        {
            kind: 'transfer',
            from: sender.address,
            to: recipient.address,
            assetRef: nativeRef,
            amount: new Decimal(1),
        },
        { scope: env.scope },
    )
    const capFee = estimate.presets!.normal.maxAmount
    const spendable = await adapter.spendableBalance({
        account: sender.walletAccount,
        asset: nativeRef,
        scope: env.scope,
        fee: capFee,
    })
    return {
        env,
        sender,
        recipient,
        nativeRef,
        capFee: BigInt(capFee.toFixed()),
        max: BigInt(spendable.max.toFixed()),
        spendable,
    }
}

/**
 * Proves "send max" on a chain with no reserve: the amount the spendable
 * balance offers (synced balance less the fee the app prices at its cap) lands
 * on the node, and what remains is exactly the part of that reserve the chain
 * did not charge, never negative. A mocked balance can't show the node accepts
 * a send that leaves the account holding less than its cap-priced fee, or that
 * a fee rising after the review is held to the max fee the sender confirmed.
 */
describe.each(['ethereum', 'base'] as const)('evm max send on %s', chain => {
    it('sends the spendable balance and leaves only the unspent reserve', async () => {
        const { env, sender, recipient, nativeRef, capFee, max, spendable } =
            await quoteMaxSend(chain)

        // Node-read inputs: the balance is the funding, the reserve formula is balance - fee.
        expect(spendable.balance.toFixed()).toBe(FUNDED.toString())
        expect(max).toBe(FUNDED - capFee)

        const { unsigned, fees } = await buildTransfer(env, {
            from: sender.address,
            to: recipient.address,
            assetRef: nativeRef,
            amount: max,
            maxFee: capFee,
        })
        const { raw, hash } = await signAndSend(env, sender, unsigned)
        await expectEvmConformant({
            env,
            intent: {
                chainId: EVMNET[chain].eip155ChainId,
                from: sender.address,
                nonce: 0,
                to: recipient.address,
                value: max,
                ...fees,
            },
            raw,
            hash,
        })

        // The reserve covers the worst case the built transaction can be charged.
        expect(fees.gas * fees.maxFeePerGas).toBeLessThanOrEqual(capFee)
        const receipt = await anvilRpc<{
            gasUsed: Hex
            effectiveGasPrice: Hex
            blockNumber: Hex
        }>(env.chain, 'eth_getTransactionReceipt', [hash])
        const gasFee =
            BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice)
        const surcharge =
            chain === 'base'
                ? await oracleOpStackFees({
                      chain,
                      raw,
                      gasUsed: BigInt(receipt.gasUsed),
                      block: BigInt(receipt.blockNumber) - 1n,
                  }).then(
                      ({ l1DataFee, operatorFee }) => l1DataFee + operatorFee,
                  )
                : 0n
        const remaining = await nativeBalanceOf(env, sender.address)
        expect(remaining).toBe(capFee - gasFee - surcharge)
        expect(remaining).toBeGreaterThanOrEqual(0n)
        expect(await nativeBalanceOf(env, recipient.address)).toBe(max)
    })

    it('still lands when the base fee rises 1.5x after the review', async () => {
        const { env, sender, recipient, nativeRef, capFee, max } =
            await quoteMaxSend(chain)
        await setNextBaseFee(env, ((await nextBaseFeeOf(env)) * 3n) / 2n)

        const { unsigned } = await buildTransfer(env, {
            from: sender.address,
            to: recipient.address,
            assetRef: nativeRef,
            amount: max,
            maxFee: capFee,
        })
        await signAndSend(env, sender, unsigned)

        expect(await nativeBalanceOf(env, recipient.address)).toBe(max)
        expect(
            await nativeBalanceOf(env, sender.address),
        ).toBeGreaterThanOrEqual(0n)
    })

    it('refuses to build when the base fee triples past the confirmed max fee', async () => {
        const { env, sender, recipient, nativeRef, capFee, max } =
            await quoteMaxSend(chain)
        await setNextBaseFee(env, (await nextBaseFeeOf(env)) * 3n)

        const error = await buildTransfer(env, {
            from: sender.address,
            to: recipient.address,
            assetRef: nativeRef,
            amount: max,
            maxFee: capFee,
        }).catch((e: unknown) => e)

        expect(error).toMatchObject({ code: EvmErrorCode.FEE_ABOVE_CONFIRMED })
    })
})
