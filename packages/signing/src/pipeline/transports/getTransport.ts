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

import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { isMultisigAccount } from '@perawallet/wallet-core-accounts'
import type { PeraSignedTransaction } from '@perawallet/wallet-core-blockchain'
import type { Network } from '@perawallet/wallet-core-shared'
import type { DataTransport, SourceMetadata } from '../types'
import {
    createAlgodTransport,
    type AlgokitClientInterface,
} from './createAlgodTransport'
import { createWalletConnectTransport } from './createWalletConnectTransport'
import { createCallbackTransport } from './createCallbackTransport'
import {
    createMultisigProposeTransport,
    type ProposeSignRequestFn,
} from './createMultisigProposeTransport'
import {
    createMultisigCosignTransport,
    type AddSignaturesFn,
} from './createMultisigCosignTransport'

/**
 * Options for creating the transport selector.
 *
 * `algokit` and `encodeSignedTransactions` are always required (algod submission).
 * Multisig functions are optional — when omitted, selecting a multisig route
 * throws at transport-selection time rather than requiring callers to provide stubs.
 */
export interface CreateTransportSelectorOptions {
    /** AlgorandClient for direct submission */
    algokit: AlgokitClientInterface
    /** Function to encode signed transactions */
    encodeSignedTransactions: (txns: PeraSignedTransaction[]) => Uint8Array[]
    /**
     * Network captured at actor creation. Transports that submit (algod) or
     * hand signed bytes to an external caller (walletconnect / webview /
     * deeplink) re-check the live network against this value at send time to
     * avoid delivering signatures intended for a different chain if the user
     * switched networks mid-flow.
     */
    network: Network
    /** Function to propose a multisig transaction (required only for multisig flows) */
    proposeSignRequest?: ProposeSignRequestFn
    /** Function to add signatures to an existing request (required only for multisig flows) */
    addSignatures?: AddSignaturesFn
}

/**
 * Creates a function that selects the appropriate transport based on
 * source type and account type.
 *
 * All transports are created lazily — only when their route is matched.
 */
export const createTransportSelector = (
    options: CreateTransportSelectorOptions,
): ((source: SourceMetadata, account: WalletAccount) => DataTransport) => {
    return (source: SourceMetadata, account: WalletAccount): DataTransport => {
        // External callback sources (WalletConnect, webview, deeplink) go back via callback
        if (
            source.type === 'walletconnect' ||
            source.type === 'webview' ||
            source.type === 'deeplink'
        ) {
            return createWalletConnectTransport(options.network)
        }

        // Multisig co-sign adds signatures to existing request
        if (source.type === 'multisig-cosign') {
            if (!options.addSignatures) {
                throw new Error(
                    'Multisig co-sign transport requires addSignatures',
                )
            }
            return createMultisigCosignTransport(options.addSignatures)
        }

        // Multisig account with local source = propose new request
        if (isMultisigAccount(account) && source.type === 'local') {
            if (!options.proposeSignRequest) {
                throw new Error(
                    'Multisig propose transport requires proposeSignRequest',
                )
            }
            return createMultisigProposeTransport(options.proposeSignRequest)
        }

        // Local + callback: hand the signed bytes back to the caller instead
        // of submitting (e.g. swap, which submits its own assembled groups).
        // Dispatch on the tagged `transport` field, not on the shape of
        // `callbacks`, so the selector stays predictable as new caller
        // shapes are added.
        if (source.transport === 'callback') {
            return createCallbackTransport()
        }

        // Everything else goes directly to algod
        return createAlgodTransport(
            options.algokit,
            options.encodeSignedTransactions,
            options.network,
        )
    }
}
