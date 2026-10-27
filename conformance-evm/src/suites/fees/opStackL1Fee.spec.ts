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

import type { Address, Hex } from 'viem'
import { describe, expect, it } from 'vitest'
import { createEvmClient } from '@perawallet/wallet-core-chain-ethereum/blockchain/utils/createEvmClient'
import {
    readTransferFees,
    toEvmFeeEstimate,
} from '@perawallet/wallet-core-chain-ethereum/transfer/fees'

import {
    createRawKeyEvmAccount,
    fundEvmAccount,
    nativeBalanceOf,
} from '../../harness/accounts'
import { castCall } from '../../harness/cast'
import {
    OP_STACK_GAS_PRICE_ORACLE,
    oracleOpStackFees,
} from '../../harness/contracts'
import { createEvmConformanceEnv } from '../../harness/context'
import { EVMNET, anvilRpc } from '../../harness/evmnet'
import {
    buildTransfer,
    expectEvmConformant,
    signAndSend,
} from '../construction/support'

const RECIPIENT: Address = '0x000000000000000000000000000000000000dEaD'

const oracleFlag = async (sig: string): Promise<string> =>
    castCall({ chain: 'base', to: OP_STACK_GAS_PRICE_ORACLE, sig })

/**
 * Proves Base's fee read prices the OP-stack L1 data and operator fees from
 * the real GasPriceOracle and L1Block contracts (captured from Base Sepolia),
 * and that the node charges the sender exactly that surcharge on top of gas.
 * A mocked oracle can't show the app calls the right contract with a
 * transaction the oracle prices like the node does.
 */
describe('evm op-stack l1 fee (base)', () => {
    it('serves the captured oracle with every fee upgrade active', async () => {
        // Node acceptance: the installed predeploys answer as Base Sepolia's do.
        for (const flag of [
            'isEcotone()(bool)',
            'isFjord()(bool)',
            'isIsthmus()(bool)',
        ]) {
            expect(await oracleFlag(flag)).toBe('true')
        }
        expect(BigInt(await oracleFlag('l1BaseFee()'))).toBeGreaterThan(0n)
        expect(BigInt(await oracleFlag('blobBaseFee()'))).toBeGreaterThan(0n)
    })

    it('estimates the oracle surcharge and the node charges exactly it', async () => {
        const env = await createEvmConformanceEnv('base')
        const sender = await createRawKeyEvmAccount(env)
        await fundEvmAccount(env, sender.address, 10n ** 18n)
        const value = 1000n
        const client = createEvmClient(env.scope, env.ctx, env.evmChain)
        const fees = await readTransferFees(
            client,
            {
                chainId: EVMNET.base.eip155ChainId,
                from: sender.address,
                to: RECIPIENT,
                value,
            },
            env.evmChain,
            env.scope.networkId,
        )
        expect(fees.surcharge).toBeGreaterThan(0n)

        const { unsigned, fees: chosen } = await buildTransfer(env, {
            from: sender.address,
            to: RECIPIENT,
            assetRef: env.evmChain.descriptor.nativeAsset.ref,
            amount: value,
        })
        const { raw, hash } = await signAndSend(env, sender, unsigned)

        const receipt = await expectEvmConformant({
            env,
            intent: {
                chainId: EVMNET.base.eip155ChainId,
                from: sender.address,
                nonce: 0,
                to: RECIPIENT,
                value,
                // App-chosen: gas and fee caps.
                ...chosen,
            },
            raw,
            hash,
        })

        // Oracle parity: the app's surcharge is the oracle's price for the transaction it signed.
        const oracle = await oracleOpStackFees({
            chain: 'base',
            raw,
            gasUsed: receipt.gasUsed,
            block: receipt.blockNumber - 1n,
        })
        expect(fees.surcharge).toBe(oracle.l1DataFee + oracle.operatorFee)

        // Node acceptance: what the node took beyond value and gas is the app's surcharge.
        const [before, after] = await Promise.all([
            nativeBalanceOf(env, sender.address, receipt.blockNumber - 1n),
            nativeBalanceOf(env, sender.address, receipt.blockNumber),
        ])
        const charged =
            before - after - value - receipt.gasUsed * receipt.effectiveGasPrice
        expect(charged).toBe(fees.surcharge)

        // The fee the user is shown carries the surcharge on every preset.
        const estimate = toEvmFeeEstimate(fees, 'normal', env.evmChain)
        const { maxPriorityFeePerGas } = fees.presets.normal
        expect(estimate.amount.toFixed()).toBe(
            (
                fees.gas * (fees.baseFeePerGas + maxPriorityFeePerGas) +
                charged
            ).toString(),
        )

        // Anvil charges the fee but omits `l1Fee` from the receipt, so the
        // balance delta is the proof; once it reports one, this flags it.
        const nodeReceipt = await anvilRpc<{ l1Fee?: Hex }>(
            'base',
            'eth_getTransactionReceipt',
            [hash],
        )
        expect(nodeReceipt.l1Fee).toBeUndefined()
    })
})
