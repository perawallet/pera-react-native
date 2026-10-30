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

// Dependency-free: content scripts read these names and codes through the
// `wire` entry.

export const EIP1193_DAPP_KIND = 'dapp-eip1193' as const

/** CAIP-2 namespace of the chains an EIP-1193 page can reach. */
export const EIP155_NAMESPACE = 'eip155' as const

export const EIP1193_METHOD = {
    requestAccounts: 'eth_requestAccounts',
    accounts: 'eth_accounts',
    chainId: 'eth_chainId',
    switchChain: 'wallet_switchEthereumChain',
    addChain: 'wallet_addEthereumChain',
    revokePermissions: 'wallet_revokePermissions',
    sendTransaction: 'eth_sendTransaction',
    personalSign: 'personal_sign',
    signTypedDataV4: 'eth_signTypedData_v4',
    signTypedData: 'eth_signTypedData',
} as const

/**
 * The signing methods the handler queues for the user's approval; a chain
 * that adds a signing method is refused until it is named here too.
 */
export const EIP1193_SIGNING_METHODS: readonly string[] = [
    EIP1193_METHOD.sendTransaction,
    EIP1193_METHOD.personalSign,
    EIP1193_METHOD.signTypedDataV4,
    EIP1193_METHOD.signTypedData,
]

/**
 * Every method that waits in a site's approval queue, and so on the longer
 * page backstop. A switch queues with the signing requests so it can never
 * move the site's chain under a request already on screen.
 */
export const EIP1193_QUEUED_METHODS: readonly string[] = [
    ...EIP1193_SIGNING_METHODS,
    EIP1193_METHOD.switchChain,
    EIP1193_METHOD.addChain,
]

export const EIP1193_EVENT = {
    connect: 'connect',
    disconnect: 'disconnect',
    chainChanged: 'chainChanged',
    accountsChanged: 'accountsChanged',
} as const
export type Eip1193Event = (typeof EIP1193_EVENT)[keyof typeof EIP1193_EVENT]

/** EIP-1193 provider errors, EIP-3326's unrecognised chain and the EIP-1474 codes viem and wagmi read. */
export const EIP1193_ERROR_CODE = {
    userRejected: 4001,
    unauthorized: 4100,
    unsupportedMethod: 4200,
    disconnected: 4900,
    chainDisconnected: 4901,
    unrecognizedChain: 4902,
    resourceUnavailable: -32_002,
    limitExceeded: -32_005,
    invalidParams: -32_602,
    internal: -32_603,
} as const

/** What the user grants at connect, as the approval and Connections settings list it. */
export const EIP1193_PERMISSION_METHODS: readonly string[] = [
    EIP1193_METHOD.accounts,
    EIP1193_METHOD.switchChain,
]
