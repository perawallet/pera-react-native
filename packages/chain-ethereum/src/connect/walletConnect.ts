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

import {
    bytesToHex,
    getAddress,
    hexToBigInt,
    isAddress,
    isHex,
    numberToHex,
} from 'viem'
import type { Hex } from 'viem'
import type {
    ChainContext,
    NetworkId,
} from '@perawallet/wallet-core-chain-contract'
import {
    DappRequestCodedError,
    type DappRequestChainAdapter,
    type DappRequestFailure,
    type WalletConnectRequestRoute,
} from '@perawallet/wallet-core-connections'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { eip155ChainIdOfNetwork } from '../blockchain/utils/caip19'
import type { EvmChain } from '../chains/types'
import { refuseUnsupportedSendCalls } from './callBatch/params'
import {
    ethereumWalletCapabilities,
    findEthereumCallBatch,
    readEthereumCallsStatus,
} from './callBatch/status'

export const ETHEREUM_CAIP2_NAMESPACE = 'eip155'

export const ETHEREUM_WC_V2_METHOD = {
    sendTransaction: 'eth_sendTransaction',
    personalSign: 'personal_sign',
    signTypedDataV4: 'eth_signTypedData_v4',
    switchChain: 'wallet_switchEthereumChain',
    accounts: 'eth_accounts',
    requestAccounts: 'eth_requestAccounts',
    chainId: 'eth_chainId',
    getCapabilities: 'wallet_getCapabilities',
    sendCalls: 'wallet_sendCalls',
    getCallsStatus: 'wallet_getCallsStatus',
    showCallsStatus: 'wallet_showCallsStatus',
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

const MESSAGE_SIGNING_OFF: WalletConnectRequestRoute = {
    kind: 'refused',
    error: {
        code: EIP_1193_CODE['unsupported-method'],
        message: 'This wallet does not sign messages on this chain',
    },
}

// Read per request, not at registration, so remote config and Feature Flags reach sessions already approved.
const isMessageSigningEnabled = (chain: EvmChain): boolean => {
    const { chains } = getProvider()
    return (
        chains.has(chain.row.id) &&
        chains.capabilities(chain.row.id).messageSigning
    )
}

const routeMessage = (
    chain: EvmChain,
    type: 'sign-message' | 'sign-typed-data',
    params: unknown,
): WalletConnectRequestRoute => {
    if (!isMessageSigningEnabled(chain)) return MESSAGE_SIGNING_OFF
    return { kind: 'operation', type, params }
}

/** EIP-3326's answer to a chain the wallet does not have; it has no `DappRequestFailure`. */
const EIP3326_UNRECOGNIZED_CHAIN = 4902

const caip2ChainIdFor =
    (chain: EvmChain) =>
    (networkId: NetworkId): Nullable<string> =>
        chain.descriptor.networks.find(network => network.id === networkId)
            ?.caip2 ?? null

const networkForCaip2ChainId =
    (chain: EvmChain) =>
    (caip2: string): Nullable<NetworkId> =>
        chain.descriptor.networks.find(network => network.caip2 === caip2)
            ?.id ?? null

const firstPositional = (params: unknown): unknown => {
    if (!Array.isArray(params)) return params
    const positional: unknown[] = params
    return positional[0]
}

// `[{ chainId: '0x…' }]`, the hex quantity EIP-3326 specifies.
const requestedChainId = (params: unknown): Nullable<bigint> => {
    const first = firstPositional(params)
    if (typeof first !== 'object' || first === null) return null
    const { chainId } = first as { chainId?: unknown }
    return isHex(chainId, { strict: true }) && chainId.length > 2
        ? hexToBigInt(chainId)
        : null
}

const routeSwitch = (
    chain: EvmChain,
    params: unknown,
): WalletConnectRequestRoute => {
    const requested = requestedChainId(params)
    if (requested === null) {
        return {
            kind: 'refused',
            error: {
                code: EIP_1193_CODE['invalid-params'],
                message: 'Expected [{ chainId }] with a hex chain id',
            },
        }
    }
    const networkId = networkForCaip2ChainId(chain)(
        `${ETHEREUM_CAIP2_NAMESPACE}:${requested}`,
    )
    if (networkId === null) {
        return {
            kind: 'refused',
            error: {
                code: EIP3326_UNRECOGNIZED_CHAIN,
                message: 'This wallet does not have that chain',
            },
        }
    }
    return { kind: 'switch-network', networkId }
}

const SIGNING_METHODS = [
    ETHEREUM_WC_V2_METHOD.sendTransaction,
    ETHEREUM_WC_V2_METHOD.personalSign,
    ETHEREUM_WC_V2_METHOD.signTypedDataV4,
    ETHEREUM_WC_V2_METHOD.switchChain,
    ETHEREUM_WC_V2_METHOD.sendCalls,
] as const

// eth_signTransaction, eth_sendRawTransaction and eth_sign are deliberately
// absent: they route `unsupported`.
const METHODS = [
    ...SIGNING_METHODS,
    ETHEREUM_WC_V2_METHOD.accounts,
    ETHEREUM_WC_V2_METHOD.requestAccounts,
    ETHEREUM_WC_V2_METHOD.chainId,
    ETHEREUM_WC_V2_METHOD.getCapabilities,
    ETHEREUM_WC_V2_METHOD.getCallsStatus,
    ETHEREUM_WC_V2_METHOD.showCallsStatus,
] as const

const invalidParams = (message: string): DappRequestCodedError =>
    new DappRequestCodedError(EIP_1193_CODE['invalid-params'], message)

// `[address, chainIds?]`; an account the session doesn't hold is refused, as
// EIP-5792 asks.
const answerCapabilities =
    (chain: EvmChain, params: unknown) => (addresses: readonly string[]) => {
        const [address, chainIds] = Array.isArray(params)
            ? (params as unknown[])
            : []
        if (
            typeof address !== 'string' ||
            !isAddress(address) ||
            !addresses.some(
                held =>
                    isAddress(held) && getAddress(held) === getAddress(address),
            )
        ) {
            throw new DappRequestCodedError(
                EIP_1193_CODE['unauthorized-account'],
                'The address is not an account of this session',
            )
        }
        if (
            chainIds !== undefined &&
            !(
                Array.isArray(chainIds) &&
                chainIds.every(chainId => isHex(chainId, { strict: true }))
            )
        ) {
            throw invalidParams('chainIds must be hex chain ids')
        }
        return ethereumWalletCapabilities(chain, chainIds as Hex[] | undefined)
    }

const answerCallsStatus =
    (ctx: ChainContext, chain: EvmChain, params: unknown) =>
    async (addresses: readonly string[]) => {
        const id = firstPositional(params)
        if (typeof id !== 'string') throw invalidParams('Expected [id]')
        const batch = await findEthereumCallBatch(chain, id, addresses)
        return readEthereumCallsStatus(ctx, chain, batch)
    }

const routeSendCalls = (params: unknown): WalletConnectRequestRoute => {
    const refusal = refuseUnsupportedSendCalls(params)
    return refusal
        ? { kind: 'refused', error: refusal }
        : { kind: 'operation', type: 'send-batch', params }
}

const createV2 = (
    ctx: ChainContext,
    chain: EvmChain,
): NonNullable<DappRequestChainAdapter['walletConnect']['v2']> => ({
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
                return routeMessage(chain, 'sign-message', params)
            }
            case ETHEREUM_WC_V2_METHOD.signTypedDataV4: {
                return routeMessage(chain, 'sign-typed-data', params)
            }
            case ETHEREUM_WC_V2_METHOD.switchChain: {
                return routeSwitch(chain, params)
            }
            case ETHEREUM_WC_V2_METHOD.sendCalls: {
                return routeSendCalls(params)
            }
            case ETHEREUM_WC_V2_METHOD.showCallsStatus: {
                return {
                    kind: 'operation',
                    type: 'show-batch',
                    params: { batchId: firstPositional(params) },
                }
            }
            case ETHEREUM_WC_V2_METHOD.getCapabilities: {
                return {
                    kind: 'public-data',
                    answer: answerCapabilities(chain, params),
                }
            }
            case ETHEREUM_WC_V2_METHOD.getCallsStatus: {
                return {
                    kind: 'public-data',
                    answer: answerCallsStatus(ctx, chain, params),
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
                        const eip155ChainId = eip155ChainIdOfNetwork(
                            chain,
                            networkId,
                        )
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
    sessionEvents: {
        chainChangedData: networkId => {
            const eip155ChainId = eip155ChainIdOfNetwork(chain, networkId)
            return eip155ChainId === undefined
                ? null
                : numberToHex(eip155ChainId)
        },
    },
})

export const createEvmWalletConnectSupport = (
    ctx: ChainContext,
    chain: EvmChain,
): DappRequestChainAdapter['walletConnect'] => ({
    namespace: ETHEREUM_CAIP2_NAMESPACE,
    caip2ChainIdFor: caip2ChainIdFor(chain),
    networkForCaip2ChainId: networkForCaip2ChainId(chain),
    toWireResult: result => {
        if (result.type === 'send-transaction') return result.txId
        if (result.type === 'switch-network') return null
        if (result.type === 'send-batch') return { id: result.batchId }
        if (result.type === 'show-batch') return null
        if (
            result.type === 'sign-message' ||
            result.type === 'sign-typed-data'
        ) {
            return bytesToHex(result.signature)
        }
        throw new Error(`An EVM chain answers no ${result.type} result`)
    },
    toWireErrorCode: failure => EIP_1193_CODE[failure],
    v2: createV2(ctx, chain),
})
