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

import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { isMultisigAccount } from '@perawallet/wallet-core-accounts'
import type { PeraSignedTxnResult } from '@perawallet/wallet-core-blockchain'
import type { Network } from '@perawallet/wallet-core-shared'
import type { DataTransport, SourceMetadata } from '../types'
import { isExternalCallbackSource } from '../types'
import {
    createAlgodTransport,
    type AlgokitClientInterface,
} from './createAlgodTransport'
import { createWalletConnectTransport } from './createWalletConnectTransport'
import { createCallbackTransport } from './createCallbackTransport'
import {
    createMultisigProposeTransport,
    type CreateDraftSignRequestFn,
    type GetDeviceIdFn,
    type GetMsigMetadataFn,
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
    encodeSignedTransactions: (txns: PeraSignedTxnResult[]) => Uint8Array[]
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
    /**
     * Resolves multisig metadata for a given account address. Required by
     * the propose transport for sync-flow handoffs so the resolver listener
     * can assemble the composite multisig signed transaction. Optional for
     * cosign-only configurations; the transport selector throws at
     * selection time if a sync-flow handoff requires it but it's missing.
     */
    getMsigMetadata?: GetMsigMetadataFn
    /**
     * Returns the persistent device id for `with-signatures` and
     * `mark-confirmed` API calls in the sync-flow handoff. Optional;
     * required only when the propose transport handles an external source.
     */
    getDeviceId?: GetDeviceIdFn
    /**
     * Creates a local draft sign-request when the propose transport
     * receives an empty signers array — the deferred-propose path for
     * hardware-only proposers. Without this, the transport throws on
     * empty signers (preserves legacy behavior for callers that don't
     * opt into deferred propose).
     */
    createDraftSignRequest?: CreateDraftSignRequestFn
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
        // Multisig co-sign adds signatures to an existing backend request.
        // Routed first because the `multisig-cosign` source carries its own
        // signRequestId regardless of account-shape.
        if (source.type === 'multisig-cosign') {
            if (!options.addSignatures) {
                throw new Error(
                    'Multisig co-sign transport requires addSignatures',
                )
            }
            return createMultisigCosignTransport(
                options.addSignatures,
                options.network,
            )
        }

        // Multisig account → propose a new sign-request to the backend,
        // regardless of source. This covers:
        //   - `'local'`: proposer's first send from an in-app screen.
        //     `type: 'async'` — backend handles broadcast.
        //   - `'walletconnect'` / `'webview'` / `'deeplink'`: sync-flow
        //     handoff. `type: 'sync'` — wallet delivers the assembled
        //     signed bytes to the dApp once threshold is met (via the
        //     resolver listener). Hoisted above the external-callback
        //     rule below so multisig wins over source type.
        if (
            isMultisigAccount(account) &&
            (source.type === 'local' || isExternalCallbackSource(source.type))
        ) {
            if (!options.proposeSignRequest) {
                throw new Error(
                    'Multisig propose transport requires proposeSignRequest',
                )
            }
            if (!options.getMsigMetadata) {
                throw new Error(
                    'Multisig propose transport requires getMsigMetadata',
                )
            }
            if (!options.getDeviceId) {
                throw new Error(
                    'Multisig propose transport requires getDeviceId',
                )
            }
            return createMultisigProposeTransport(
                options.proposeSignRequest,
                options.network,
                options.getMsigMetadata,
                options.getDeviceId,
                options.createDraftSignRequest,
            )
        }

        // External callback sources (WalletConnect, webview, deeplink) go
        // back via callback for non-multisig accounts.
        if (isExternalCallbackSource(source.type)) {
            return createWalletConnectTransport(options.network)
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
