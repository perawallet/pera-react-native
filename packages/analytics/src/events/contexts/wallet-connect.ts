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
    SessionApproved = 'wc_session_approved', // Approved a dapp connection (version, topic, dapp name/url, address, total accounts)
    SessionDisconnected = 'wc_session_disconnected', // Disconnected a session (version, dapp name/url, opt. address)
    SessionRejected = 'wc_session_rejected', // Rejected a connection request (version, topic, dapp name/url)
    TransactionConfirmed = 'wc_transaction_confirmed', // Confirmed a dapp transaction (version, tx id, dapp name/url)
    TransactionDeclined = 'wc_transaction_declined', // Declined a dapp transaction (version, tx count, dapp name/url, opt. address)
    TransactionRequestDidAppear = 'wc_transaction_request_DidAppear', // Transaction-request screen appeared
    TransactionRequestDidLoad = 'wc_transaction_request_DidLoad', // Transaction request finished loading
    TransactionRequestReceived = 'wc_transaction_request_Received', // A transaction request was received
    TransactionRequestValidated = 'wc_transaction_request_Validated', // A transaction request passed validation
}

/** WalletConnect protocol version ('1' or '2'). */
export type WalletConnectVersion = '1' | '2'

export interface WalletConnectRequiredPayloads {
    [WalletConnectEvent.SessionApproved]: {
        [Key.WcVersion]: WalletConnectVersion
        [Key.WcSessionTopic]: string
        [Key.DappName]: string
        [Key.DappUrl]: string
        [Key.AccountAddress]: string
        [Key.TotalAccount]: number
    }
    [WalletConnectEvent.SessionRejected]: {
        [Key.WcVersion]: WalletConnectVersion
        [Key.WcSessionTopic]: string
        [Key.DappName]: string
        [Key.DappUrl]: string
    }
    [WalletConnectEvent.SessionDisconnected]: {
        [Key.WcVersion]: WalletConnectVersion
        [Key.DappName]: string
        [Key.DappUrl]: string
        [Key.AccountAddress]?: string
    }
    [WalletConnectEvent.TransactionConfirmed]: {
        [Key.WcVersion]: WalletConnectVersion
        [Key.TransactionId]: string
        [Key.DappName]: string
        [Key.DappUrl]: string
    }
    [WalletConnectEvent.TransactionDeclined]: {
        [Key.WcVersion]: WalletConnectVersion
        [Key.TransactionCount]: number
        [Key.DappName]: string
        [Key.DappUrl]: string
        [Key.AccountAddress]?: string
    }
}
