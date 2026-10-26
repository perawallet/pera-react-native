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

import type { ChainContext } from '@perawallet/wallet-core-chain-contract'
import type { DappRequestChainAdapter } from '@perawallet/wallet-core-connections'
import { eip155ChainIdOfNetwork } from '../blockchain/utils/caip19'
import { ethereumKindIdOf } from '../accounts/local-key-kinds'
import type { EvmChain } from '../chains/types'
import { validateEthereumMessagePayload } from './messageParams'
import {
    buildEthereumSendTransaction,
    validateEthereumSendTransaction,
    type EthereumSendTransactionRequest,
} from './sendTransaction'
import { startEthereumCallBatch } from './callBatch/executor'
import {
    validateEthereumSendCalls,
    type EthereumCallBatchRequest,
} from './callBatch/params'
import { prepareEthereumCallBatch } from './callBatch/prepare'
import { findEthereumCallBatch } from './callBatch/status'
import { createEvmWalletConnectSupport } from './walletConnect'

const NO_TRANSACTION_GROUP =
    'eip155 signs no transaction group; use eth_sendTransaction'

const refuseTransactionGroup = (): never => {
    throw new Error(NO_TRANSACTION_GROUP)
}

export const createEthereumDappRequestAdapter = (
    ctx: ChainContext,
    chain: EvmChain,
): DappRequestChainAdapter => ({
    chainId: chain.row.id,
    relayableErrorNames: [],
    // The kind id, not a wire name: no Ethereum bridge vocabulary exists to map to.
    accountTypeOf: account => ethereumKindIdOf(account),

    parseSigningParams: type => ({
        ok: false,
        reason: 'missing',
        message: `No ${type} payload: Ethereum dApp requests arrive over WalletConnect v2`,
    }),

    resolveReportedNetwork: scope =>
        scope.chainId === chain.row.id &&
        chain.descriptor.networks.some(({ id }) => id === scope.networkId)
            ? scope.networkId
            : undefined,

    emptySignaturesFor: () => ({}),

    walletConnect: createEvmWalletConnectSupport(ctx, chain),

    validateTransactionPayload: () => ({
        ok: false,
        message: NO_TRANSACTION_GROUP,
    }),

    validateMessagePayload: (type, params, authorizedAccounts) =>
        validateEthereumMessagePayload(type, params, authorizedAccounts, {
            eip155ChainId: eip155ChainIdOfNetwork(
                chain,
                ctx.getScope().networkId,
            ),
        }),

    useEnqueueTransactionSigning: () => refuseTransactionGroup,

    // The v2 handler checked the envelope chain against the selected network
    // in the same tick; the pipeline re-checks the scope before it signs.
    sendTransaction: {
        validate: (params, authorizedAccounts) =>
            validateEthereumSendTransaction(params, {
                authorizedAccounts,
                eip155ChainId: eip155ChainIdOfNetwork(
                    chain,
                    ctx.getScope().networkId,
                ),
            }),
        // `validate` is the only producer of the request.
        build: request =>
            buildEthereumSendTransaction(
                ctx,
                chain,
                request as EthereumSendTransactionRequest,
            ),
    },

    sendBatch: {
        validate: (params, authorizedAccounts) =>
            validateEthereumSendCalls(params, {
                authorizedAccounts,
                eip155ChainId: eip155ChainIdOfNetwork(
                    chain,
                    ctx.getScope().networkId,
                ),
            }),
        // `validate` is the only producer of the request.
        prepare: request =>
            prepareEthereumCallBatch(
                ctx,
                chain,
                request as EthereumCallBatchRequest,
            ),
        start: (prepared, first, approval) =>
            startEthereumCallBatch(ctx, chain, prepared, first, approval),
        locate: async (batchId, authorizedAccounts) => {
            const batch = await findEthereumCallBatch(
                chain,
                batchId,
                authorizedAccounts,
            )
            const [txId] = batch.txIds
            return txId === undefined ? null : { scope: batch.scope, txId }
        },
    },
})
