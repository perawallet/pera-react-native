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
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { eip155ChainIdOfNetwork } from '../blockchain/utils/caip19'
import type { EvmChain } from '../chains/types'
import { isMessageSigningEnabled } from '../signing/messageSigningGate'
import { refuseUnsupportedSendCalls } from './callBatch/params'
import {
    ethereumWalletCapabilities,
    findEthereumCallBatch,
    readEthereumCallsStatus,
} from './callBatch/status'
import { isTypedDataV4Params } from './typedDataVersion'

export const ETHEREUM_CAIP2_NAMESPACE = 'eip155'

export const ETHEREUM_WC_V2_METHOD = {
    sendTransaction: 'eth_sendTransaction',
    personalSign: 'personal_sign',
    signTypedDataV4: 'eth_signTypedData_v4',
    signTypedData: 'eth_signTypedData',
    switchChain: 'wallet_switchEthereumChain',
    accounts: 'eth_accounts',
    requestAccounts: 'eth_requestAccounts',
    chainId: 'eth_chainId',
    getCapabilities: 'wallet_getCapabilities',
    sendCalls: 'wallet_sendCalls',
    getCallsStatus: 'wallet_getCallsStatus',
    showCallsStatus: 'wallet_showCallsStatus',
    sign: 'eth_sign',
    signTypedDataV3: 'eth_signTypedData_v3',
    signTransaction: 'eth_signTransaction',
    sendRawTransaction: 'eth_sendRawTransaction',
    getPermissions: 'wallet_getPermissions',
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
    // EIP-3326's answer to a chain the wallet does not have.
    'unrecognized-chain': 4902,
    'invalid-params': -32_602,
    'limit-exceeded': -32_005,
}

const MESSAGE_SIGNING_OFF: WalletConnectRequestRoute = {
    kind: 'refused',
    error: {
        code: EIP_1193_CODE['unsupported-method'],
        message: 'This wallet does not sign messages on this chain',
    },
    failure: 'unsupported-method',
}

const routeMessage = (
    chain: EvmChain,
    type: 'sign-message' | 'sign-typed-data',
    params: unknown,
): WalletConnectRequestRoute => {
    if (!isMessageSigningEnabled(chain)) return MESSAGE_SIGNING_OFF
    return { kind: 'operation', type, params }
}

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

// The chain is not judged here: the target may belong to another EVM chain, so
// the handler resolves it across every chain of the namespace.
const routeSwitch = (params: unknown): WalletConnectRequestRoute => {
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
    return {
        kind: 'switch-network',
        caip2ChainId: `${ETHEREUM_CAIP2_NAMESPACE}:${requested}`,
    }
}

const SIGNING_METHODS = [
    ETHEREUM_WC_V2_METHOD.sendTransaction,
    ETHEREUM_WC_V2_METHOD.personalSign,
    ETHEREUM_WC_V2_METHOD.signTypedDataV4,
    ETHEREUM_WC_V2_METHOD.signTypedData,
    ETHEREUM_WC_V2_METHOD.switchChain,
    ETHEREUM_WC_V2_METHOD.sendCalls,
] as const

// Listed so proposals that require them connect; every call answers 4200: no
// blind signing, signing without sending, raw broadcasts, v3 typed data or
// EIP-2255 permissions.
const REFUSED_METHODS: readonly string[] = [
    ETHEREUM_WC_V2_METHOD.sign,
    ETHEREUM_WC_V2_METHOD.signTypedDataV3,
    ETHEREUM_WC_V2_METHOD.signTransaction,
    ETHEREUM_WC_V2_METHOD.sendRawTransaction,
    ETHEREUM_WC_V2_METHOD.getPermissions,
]

// dApps probe it unprompted, so refusing it must not alert the user.
const SILENTLY_REFUSED_METHODS: readonly string[] = [
    ETHEREUM_WC_V2_METHOD.getPermissions,
]

const METHODS = [
    ...SIGNING_METHODS,
    ETHEREUM_WC_V2_METHOD.accounts,
    ETHEREUM_WC_V2_METHOD.requestAccounts,
    ETHEREUM_WC_V2_METHOD.chainId,
    ETHEREUM_WC_V2_METHOD.getCapabilities,
    ETHEREUM_WC_V2_METHOD.getCallsStatus,
    ETHEREUM_WC_V2_METHOD.showCallsStatus,
    ...REFUSED_METHODS,
] as const

const refuseAsUnsupported = (
    message: string,
    { isSilent = false }: { isSilent?: boolean } = {},
): WalletConnectRequestRoute => ({
    kind: 'refused',
    error: { code: EIP_1193_CODE['unsupported-method'], message },
    ...(isSilent ? {} : { failure: 'unsupported-method' as const }),
})

// The route is where the version is known: the validator only sees
// `sign-typed-data`, and v1 orders its params differently.
const routeUnversionedTypedData = (
    params: unknown,
): WalletConnectRequestRoute =>
    isTypedDataV4Params(params)
        ? { kind: 'operation', type: 'sign-typed-data', params }
        : refuseAsUnsupported(
              'eth_signTypedData is served only for a v4 typed-data object',
          )

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
        return ethereumWalletCapabilities(chain, chainIds as Optional<Hex[]>)
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
            case ETHEREUM_WC_V2_METHOD.signTypedData: {
                return routeUnversionedTypedData(params)
            }
            case ETHEREUM_WC_V2_METHOD.switchChain: {
                return routeSwitch(params)
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
                return REFUSED_METHODS.includes(method)
                    ? refuseAsUnsupported(`Pera does not serve ${method}`, {
                          isSilent: SILENTLY_REFUSED_METHODS.includes(method),
                      })
                    : { kind: 'unsupported' }
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
