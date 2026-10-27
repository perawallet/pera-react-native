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
import type { Address, Hex } from 'viem'
import type {
    AssetRef,
    UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import type { EthereumTransactionPayload } from '@perawallet/wallet-core-chain-ethereum/signing/adapter'
import { createEvmTransferAdapter } from '@perawallet/wallet-core-chain-ethereum/transfer/builder'

import type { EvmConformanceAccount } from '../../harness/accounts'
import { expectEvmConformant } from '../../harness/assert/roundTrip'
import type { EvmConformanceEnv } from '../../harness/context'
import { signTransactionWithApp } from '../../harness/sign'
import { broadcastAndConfirm } from '../../harness/submit'

/** The fields only the app chooses: gas and the fee caps. */
export type AppChosenFees = {
    gas: bigint
    maxFeePerGas: bigint
    maxPriorityFeePerGas: bigint
}

export const buildTransfer = async (
    env: EvmConformanceEnv,
    input: {
        from: Address
        to: Address
        assetRef: AssetRef
        amount: bigint
    },
): Promise<{ unsigned: UnsignedTransaction; fees: AppChosenFees }> => {
    const [unsigned] = await createEvmTransferAdapter(
        env.ctx,
        env.evmChain,
    ).build(
        {
            kind: 'transfer',
            from: input.from,
            to: input.to,
            assetRef: input.assetRef,
            amount: new Decimal(input.amount.toString()),
        },
        { scope: env.scope },
    )
    const { transaction } = unsigned.payload as EthereumTransactionPayload
    const fees = {
        gas: transaction.gas!,
        maxFeePerGas: transaction.maxFeePerGas!,
        maxPriorityFeePerGas: transaction.maxPriorityFeePerGas!,
    }
    // Sanity bounds on what the app chose; the rest of the intent is declared by the test.
    if (
        fees.gas < 21_000n ||
        fees.maxFeePerGas < fees.maxPriorityFeePerGas ||
        fees.maxFeePerGas === 0n
    ) {
        throw new Error(
            `implausible app-chosen fees: ${JSON.stringify(fees, (_, v) => (typeof v === 'bigint' ? v.toString() : v))}`,
        )
    }
    return { unsigned, fees }
}

/** Signs with the app, broadcasts through the app, and returns the exact bytes and hash. */
export const signAndSend = async (
    env: EvmConformanceEnv,
    sender: EvmConformanceAccount,
    unsigned: UnsignedTransaction,
): Promise<{ raw: Hex; hash: Hex }> => {
    const raw = await signTransactionWithApp(env, sender, unsigned)
    const { hash } = await broadcastAndConfirm(env, raw)
    return { raw, hash }
}

export { expectEvmConformant }
