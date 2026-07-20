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
    type IClientMeta,
    type IWalletConnectSession,
} from '@perawallet/walletconnect/types'
import {
    type BaseStoreState,
    type Nullable,
} from '@perawallet/wallet-core-shared'

export type AlgorandChainId = 416_001 | 416_002 | 416_003 | 4160

export const AlgorandChainId = {
    mainnet: 416_001,
    testnet: 416_002,
    betanet: 416_003,
    all: 4160,
} as const

export const AlgorandChain = {
    416_001: 'mainnet',
    416_002: 'testnet',
    416_003: 'betanet',
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
}

export type WalletConnectSessionRequest = {
    peerMeta: IClientMeta
    chainId: AlgorandChainId
    permissions: string[]
    clientId: string
    /**
     * Epoch ms when the request was queued (stamped by
     * `addSessionRequest`). Requests older than `SESSION_REQUEST_TTL_MS`
     * are pruned instead of popping an approval sheet — the dApp side of
     * the handshake has long timed out, so approving one only feeds a
     * dead socket.
     */
    createdAt?: number
}

export type WalletConnectStore = BaseStoreState & {
    walletConnectConnections: WalletConnectConnection[]
    sessionRequests: WalletConnectSessionRequest[]
    /** Transient — the most recent error to surface in the WC error bottom sheet. */
    connectionError: Nullable<Error>
    setWalletConnectConnections: (
        walletConnectConnections: WalletConnectConnection[],
    ) => void
    setSessionRequests: (sessionRequests: WalletConnectSessionRequest[]) => void
    setConnectionError: (connectionError: Nullable<Error>) => void
}

export type WalletConnectTransactionPayload = {
    id: number
    jsonrpc: string
    method: 'algo_signTxn'
    params: WalletConnectTransactionParam[][]
}

export type WalletConnectTransactionParam = {
    message?: string
    txn: string
    /** ARC-0001: addresses that must sign. Empty array = do not sign. Absent = sign with sender/auth. */
    signers?: string[]
    /** ARC-0001: rekeyed auth address that should sign on behalf of the sender. */
    authAddr?: string
}
