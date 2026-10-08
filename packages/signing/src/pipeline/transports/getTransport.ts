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
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { DataTransport, SourceMetadata } from '../types'
import { isExternalCallbackSource } from '../types'
import { broadcasterChainAdapters } from '../../broadcaster'
import { createWalletConnectTransport } from './createWalletConnectTransport'
import { createCallbackTransport } from './createCallbackTransport'
import {
    plannerAdapterForScope,
    type AddSignaturesFn,
    type CreateDraftSignRequestFn,
    type GetDeviceIdFn,
    type GetMsigMetadataFn,
    type ProposeSignRequestFn,
} from '../../chain-adapter'

/**
 * The multisig functions are optional: omitting them makes a multisig route
 * throw at selection time, rather than forcing every caller to pass stubs.
 */
export interface CreateTransportSelectorOptions {
    /** Captured at actor creation; its chain picks the transports, which re-check it at send time. */
    scope: ChainScope
    /** Function to propose a multisig transaction (required only for multisig flows) */
    proposeSignRequest?: ProposeSignRequestFn
    /** Function to add signatures to an existing request (required only for multisig flows) */
    addSignatures?: AddSignaturesFn
    /**
     * Required for sync-flow handoffs, so the resolver can assemble the
     * composite multisig transaction. Optional for cosign-only setups; the
     * selector throws at selection time when a handoff needs it and it's absent.
     */
    getMsigMetadata?: GetMsigMetadataFn
    /** Required only when the propose transport handles an external source. */
    getDeviceId?: GetDeviceIdFn
    /**
     * The deferred-propose path for hardware-only proposers. Without it, an
     * empty signers array throws instead.
     */
    createDraftSignRequest?: CreateDraftSignRequestFn
}

/** Transports are created lazily, only when their route is matched. */
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
            return plannerAdapterForScope(
                options.scope,
            ).createMultisigCosignTransport(
                options.addSignatures,
                options.scope,
            )
        }

        // A multisig account always proposes, whatever the source — `async` for
        // in-app sends (backend broadcasts), `sync` for external handoffs (the
        // wallet delivers once threshold is met). Hoisted above the
        // external-callback rule below so multisig wins over source type.
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
            return plannerAdapterForScope(
                options.scope,
            ).createMultisigProposeTransport(
                options.proposeSignRequest,
                options.scope,
                options.getMsigMetadata,
                options.getDeviceId,
                options.createDraftSignRequest,
            )
        }

        // External callback sources (WalletConnect, webview, deeplink) go
        // back via callback for non-multisig accounts — unless the request
        // explicitly tagged `algod`. A keyreg scanned from a QR is
        // deeplink-sourced but has no dApp waiting on the signed bytes, so it
        // must self-submit; routing it here threw "No approve callback
        // provided" and nothing was ever broadcast.
        if (
            source.transport !== 'algod' &&
            isExternalCallbackSource(source.type)
        ) {
            return createWalletConnectTransport(options.scope)
        }

        // Hands signed bytes back rather than submitting (swap assembles and
        // submits its own groups). Dispatches on the tagged `transport` field,
        // not the shape of `callbacks`, so it stays predictable as callers
        // are added.
        if (source.transport === 'callback') {
            return createCallbackTransport()
        }

        // Everything else is submitted by the chain's broadcaster.
        return broadcasterChainAdapters
            .get(options.scope.chainId)
            .createSubmitTransport(options.scope)
    }
}
