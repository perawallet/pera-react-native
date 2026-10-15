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

import type { DappRequestChainAdapter } from '@perawallet/wallet-core-connections'
import { ethereumKindIdOf } from '../accounts/local-key-kinds'
import { ETHEREUM_CHAIN_ID } from '../chain-id'
import { ethereumDescriptor } from '../descriptor'
import { ethereumWalletConnectSupport } from './walletConnect'

const refuseTransactionGroup = (): never => {
    throw new Error(
        'eip155 signs no transaction group; use eth_sendTransaction',
    )
}

export const ethereumDappRequestAdapter: DappRequestChainAdapter = {
    chainId: ETHEREUM_CHAIN_ID,
    relayableErrorNames: [],
    // The app's own kind id: the Ethereum bridge's wire vocabulary is not
    // settled yet.
    accountTypeOf: account => ethereumKindIdOf(account),

    parseSigningParams: type => ({
        ok: false,
        reason: 'missing',
        message: `No ${type} payload: Ethereum dApp requests arrive over WalletConnect v2`,
    }),

    resolveReportedNetwork: scope =>
        scope.chainId === ETHEREUM_CHAIN_ID &&
        ethereumDescriptor.networks.some(({ id }) => id === scope.networkId)
            ? scope.networkId
            : undefined,

    emptySignaturesFor: () => ({}),

    walletConnect: ethereumWalletConnectSupport,

    validateTransactionPayload: () => ({
        ok: false,
        message: 'eip155 signs no transaction group; use eth_sendTransaction',
    }),

    useEnqueueTransactionSigning: () => refuseTransactionGroup,
}
