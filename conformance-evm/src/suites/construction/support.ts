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
import {
    PeraAssetType,
    PeraAssetVerificationTier,
    upsertAssets,
} from '@perawallet/wallet-core-assets'
import type {
    AssetRef,
    FeePreset,
    UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import type { EthereumTransactionPayload } from '@perawallet/wallet-core-chain-ethereum/signing/adapter'
import { toEvmNftAssetId } from '@perawallet/wallet-core-chain-ethereum/blockchain/utils/caip19'
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
        feePreset?: FeePreset
        /** Wei: the most the sender confirmed paying, as the review passes it on. */
        maxFee?: bigint
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
        {
            scope: env.scope,
            feePreset: input.feePreset,
            maxFee:
                input.maxFee === undefined
                    ? undefined
                    : new Decimal(input.maxFee.toString()),
        },
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

// The builder reads the standard from the asset store, which the NFT sync fills.
export const storeNft = async (
    env: EvmConformanceEnv,
    contract: `0x${string}`,
    tokenId: bigint,
    standard: 'erc721' | 'erc1155',
) => {
    const assetId = toEvmNftAssetId(contract, tokenId.toString())
    await upsertAssets({
        scope: env.scope,
        items: [
            {
                assetId,
                name: 'Conformance NFT',
                decimals: 0,
                totalSupply: new Decimal(0),
                creator: { address: contract },
                peraMetadata: {
                    isDeleted: false,
                    verificationTier: PeraAssetVerificationTier.unverified,
                    type: PeraAssetType.collectible,
                    isUnique: standard === 'erc721',
                    collectible: { standard },
                },
            },
        ],
    })
    return assetId
}

export { expectEvmConformant }
