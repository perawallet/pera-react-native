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

import type {
    ChainContext,
    ChainScope,
    UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import {
    DappRequestCodedError,
    type PreparedDappBatch,
} from '@perawallet/wallet-core-connections'
import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'
import { findTransactionBatch } from '@perawallet/wallet-core-signing'
import { eip155ChainIdOf } from '../../blockchain/utils/caip19'
import type { EvmChain } from '../../chains/types'
import type { EthereumTransactionPayload } from '../../signing/adapter'
import {
    BATCH_FEE_CEILING_MULTIPLIER,
    ethereumCallSummary,
} from '../../signing/review'
import {
    buildEthereumSendTransaction,
    type EthereumSendTransactionRequest,
} from '../sendTransaction'
import { EIP5792_ERROR_CODE } from './codes'
import type { EthereumCallBatchRequest } from './params'

/** What `start` reads back from a prepared batch. */
export type PreparedEthereumCallBatch = EthereumCallBatchRequest & {
    batchId: string
    /** Wei per gas; see {@link EthereumTransactionPayload.maxFeePerGasCeiling}. */
    maxFeePerGasCeiling: bigint
}

/**
 * A call shown on the batch's review before it can be priced: its nonce, gas
 * and fees depend on state the calls before it create, so it carries the
 * ceiling it will be signed under instead.
 */
export const previewEthereumCall = (
    scope: ChainScope,
    chain: EvmChain,
    call: EthereumSendTransactionRequest,
    maxFeePerGasCeiling: bigint,
): UnsignedTransaction => {
    const payload: EthereumTransactionPayload = {
        from: call.from,
        transaction: {
            type: 'eip1559',
            chainId: eip155ChainIdOf(scope, chain),
            to: call.to,
            value: call.value,
            data: call.data,
        },
        isPreview: true,
        maxFeePerGasCeiling,
    }
    return {
        scope,
        payload,
        summary: ethereumCallSummary(call, chain),
        chainData: { family: 'evm' },
    }
}

/**
 * Prices the first call on the selected network and previews the rest. A
 * dApp reusing an id it already sent from this account is refused first.
 */
export const prepareEthereumCallBatch = async (
    ctx: ChainContext,
    chain: EvmChain,
    request: EthereumCallBatchRequest,
): Promise<PreparedDappBatch> => {
    if (
        request.batchId !== undefined &&
        // Every chain: the id is unique per sender, which the record enforces.
        (await findTransactionBatch({
            batchId: request.batchId,
            senders: [request.from],
        }))
    ) {
        throw new DappRequestCodedError(
            EIP5792_ERROR_CODE.duplicateId,
            'A batch with this id was already sent',
        )
    }
    const scope = ctx.getScope()
    const [firstCall, ...following] = request.calls
    const first = await buildEthereumSendTransaction(ctx, chain, firstCall)
    const { maxFeePerGas } = (first.payload as EthereumTransactionPayload)
        .transaction
    if (maxFeePerGas === undefined) {
        throw new Error('The first call was built without a max fee per gas')
    }
    const maxFeePerGasCeiling = maxFeePerGas * BATCH_FEE_CEILING_MULTIPLIER
    const batchId = request.batchId ?? generateOrderedUniqueId()
    return {
        batchId,
        first,
        following: following.map(call =>
            previewEthereumCall(scope, chain, call, maxFeePerGasCeiling),
        ),
        request: {
            ...request,
            batchId,
            maxFeePerGasCeiling,
        } satisfies PreparedEthereumCallBatch,
    }
}
