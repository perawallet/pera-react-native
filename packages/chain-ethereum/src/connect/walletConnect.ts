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

import { bytesToHex, numberToHex } from 'viem'
import type { NetworkId } from '@perawallet/wallet-core-chain-contract'
import type {
    DappRequestChainAdapter,
    DappRequestFailure,
} from '@perawallet/wallet-core-connections'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { eip155ChainIdOfNetwork } from '../blockchain/utils/caip19'
import { ethereumDescriptor } from '../descriptor'

export const ETHEREUM_CAIP2_NAMESPACE = 'eip155'

export const ETHEREUM_WC_V2_METHOD = {
    sendTransaction: 'eth_sendTransaction',
    personalSign: 'personal_sign',
    signTypedDataV4: 'eth_signTypedData_v4',
    switchChain: 'wallet_switchEthereumChain',
    accounts: 'eth_accounts',
    requestAccounts: 'eth_requestAccounts',
    chainId: 'eth_chainId',
    // Named so it routes `unsupported`, but never listed: no user-added or
    // additional EVM chain.
    addChain: 'wallet_addEthereumChain',
} as const

/** EIP-1193 provider error codes, and EIP-1474's invalid params and limit exceeded, which viem and wagmi read. */
const EIP_1193_CODE: Record<DappRequestFailure, number> = {
    'user-rejected': 4001,
    'unauthorized-account': 4100,
    'unsupported-method': 4200,
    'unselected-chain': 4901,
    'invalid-params': -32_602,
    'limit-exceeded': -32_005,
}

const caip2ChainIdFor = (networkId: NetworkId): Nullable<string> =>
    ethereumDescriptor.networks.find(network => network.id === networkId)
        ?.caip2 ?? null

const networkForCaip2ChainId = (caip2: string): Nullable<NetworkId> =>
    ethereumDescriptor.networks.find(network => network.caip2 === caip2)?.id ??
    null

const firstPositional = (params: unknown): unknown => {
    if (!Array.isArray(params)) return params
    const positional: unknown[] = params
    return positional[0]
}

const SIGNING_METHODS = [
    ETHEREUM_WC_V2_METHOD.sendTransaction,
    ETHEREUM_WC_V2_METHOD.personalSign,
    ETHEREUM_WC_V2_METHOD.signTypedDataV4,
    ETHEREUM_WC_V2_METHOD.switchChain,
] as const

// eth_signTransaction, eth_sendRawTransaction, eth_sign and the EIP-5792
// wallet_* methods are deliberately absent: they route `unsupported`.
const METHODS = [
    ...SIGNING_METHODS,
    ETHEREUM_WC_V2_METHOD.accounts,
    ETHEREUM_WC_V2_METHOD.requestAccounts,
    ETHEREUM_WC_V2_METHOD.chainId,
] as const

const v2: NonNullable<DappRequestChainAdapter['walletConnect']['v2']> = {
    methods: METHODS,
    signingMethods: SIGNING_METHODS,
    handleRequest: (method, params) => {
        switch (method) {
            case ETHEREUM_WC_V2_METHOD.sendTransaction: {
                return {
                    kind: 'operation',
                    type: 'send-transaction',
                    params: firstPositional(params),
                }
            }
            case ETHEREUM_WC_V2_METHOD.personalSign: {
                return { kind: 'operation', type: 'sign-message', params }
            }
            case ETHEREUM_WC_V2_METHOD.signTypedDataV4: {
                return { kind: 'operation', type: 'sign-typed-data', params }
            }
            case ETHEREUM_WC_V2_METHOD.switchChain: {
                return {
                    kind: 'operation',
                    type: 'switch-network',
                    params: firstPositional(params),
                }
            }
            case ETHEREUM_WC_V2_METHOD.accounts:
            case ETHEREUM_WC_V2_METHOD.requestAccounts: {
                return {
                    kind: 'public-data',
                    answer: addresses => [...addresses],
                }
            }
            case ETHEREUM_WC_V2_METHOD.chainId: {
                return {
                    kind: 'public-data',
                    answer: (_addresses, networkId) => {
                        const eip155ChainId = eip155ChainIdOfNetwork(networkId)
                        return eip155ChainId === undefined
                            ? null
                            : numberToHex(eip155ChainId)
                    },
                }
            }
            default: {
                return { kind: 'unsupported' }
            }
        }
    },
}

export const ethereumWalletConnectSupport: DappRequestChainAdapter['walletConnect'] =
    {
        namespace: ETHEREUM_CAIP2_NAMESPACE,
        caip2ChainIdFor,
        networkForCaip2ChainId,
        toWireResult: result => {
            if (result.type === 'send-transaction') return result.txId
            if (
                result.type === 'sign-message' ||
                result.type === 'sign-typed-data'
            ) {
                return bytesToHex(result.signature)
            }
            throw new Error(`Ethereum answers no ${result.type} result`)
        },
        toWireErrorCode: failure => EIP_1193_CODE[failure],
        v2,
    }
