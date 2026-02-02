/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { IClientMeta, IWalletConnectSession } from '@walletconnect/types'
import { BaseStoreState } from '@perawallet/wallet-core-shared'

export type AlgorandChainId = 416001 | 416002 | 416003 | 4160

export const AlgorandChainId = {
    mainnet: 416001,
    testnet: 416002,
    betanet: 416003,
    all: 4160,
}

export const AlgorandChain = {
    416001: 'mainnet',
    416002: 'testnet',
    416003: 'betanet',
    4160: 'all',
}

export const AlgorandPermission = {
    ACCOUNT_PERMISSION: 'algo_getAccounts',
    TX_PERMISSION: 'algo_signTxn',
    DATA_PERMISSION: 'algo_signData',
} as const

export type AlgorandPermission =
    (typeof AlgorandPermission)[keyof typeof AlgorandPermission]

export type WalletConnectConnection = {
    clientId?: string
    version?: number
    bridge?: string
    uri?: string
    signingMethods?: string[]
    session?: {
        permissions?: string[]
    } & IWalletConnectSession
    connected?: boolean
    lastActiveAt?: Date
    createdAt?: Date
    autoConnect?: boolean
}

export type WalletConnectSessionRequest = {
    peerMeta: IClientMeta
    chainId: AlgorandChainId
    permissions: string[]
    clientId: string
}

export type WalletConnectStore = BaseStoreState & {
    walletConnectConnections: WalletConnectConnection[]
    sessionRequests: WalletConnectSessionRequest[]
    setWalletConnectConnections: (
        walletConnectConnections: WalletConnectConnection[],
    ) => void
    setSessionRequests: (sessionRequests: WalletConnectSessionRequest[]) => void
}

export type WalletConnectTransactionPayload = {
    id: number
    jsonrpc: string
    method: 'algo_signTxn'
    params: [WalletConnectTransactionParam[]]
}

export type WalletConnectTransactionParam = {
    txn: string
}

