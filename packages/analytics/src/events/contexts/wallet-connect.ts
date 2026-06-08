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

import { AnalyticsMetadataKey as Key } from '../metadata-keys'

/** WalletConnect session and transaction events. */
export enum WalletConnectEvent {
    SessionApproved = 'wc_session_approved', // Approved a dapp connection (dapp name/url, address, total accounts)
    SessionDisconnected = 'wc_session_disconnected', // Disconnected a session (dapp name/url)
    SessionRejected = 'wc_session_rejected', // Rejected a connection request (dapp name/url)
    TransactionConfirmed = 'wc_transaction_confirmed', // Confirmed/signed a dapp-requested transaction (dapp name/url, tx count)
    TransactionDeclined = 'wc_transaction_declined', // Declined a dapp-requested transaction (dapp name/url, tx count)
}

/** WalletConnect protocol version ('1' or '2'). */
export type WalletConnectVersion = '1' | '2'

/**
 * Dapp name/url come from the session request's `peerMeta` and are always
 * present. Wc version + topic aren't exposed by RN's WalletConnect types, so
 * those (and address/counts) are optional.
 */
export interface WalletConnectRequiredPayloads {
    [WalletConnectEvent.SessionApproved]: {
        [Key.DappName]: string
        [Key.DappUrl]: string
        [Key.WcVersion]?: WalletConnectVersion
        [Key.WcSessionTopic]?: string
        [Key.AccountAddress]?: string
        [Key.TotalAccount]?: number
    }
    [WalletConnectEvent.SessionRejected]: {
        [Key.DappName]: string
        [Key.DappUrl]: string
        [Key.WcVersion]?: WalletConnectVersion
        [Key.WcSessionTopic]?: string
    }
    [WalletConnectEvent.SessionDisconnected]: {
        [Key.DappName]: string
        [Key.DappUrl]: string
        [Key.WcVersion]?: WalletConnectVersion
        [Key.AccountAddress]?: string
    }
    [WalletConnectEvent.TransactionConfirmed]: {
        [Key.DappName]: string
        [Key.DappUrl]: string
        [Key.WcVersion]?: WalletConnectVersion
        [Key.TransactionCount]?: number
        [Key.AccountAddress]?: string
    }
    [WalletConnectEvent.TransactionDeclined]: {
        [Key.DappName]: string
        [Key.DappUrl]: string
        [Key.WcVersion]?: WalletConnectVersion
        [Key.TransactionCount]?: number
        [Key.AccountAddress]?: string
    }
}
