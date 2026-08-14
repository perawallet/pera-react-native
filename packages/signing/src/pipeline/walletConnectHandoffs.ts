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

import type { Network } from '@perawallet/wallet-core-shared'
import { useWalletConnectHandoffsStore } from '../store/walletConnectHandoffsStore'
import type { SourceCallbacks, SourceType } from './types'

/**
 * Serializable context to answer a WalletConnect peer without the in-memory
 * closures — i.e. after an app kill. The resolver reconstructs the exact
 * `algo_signTxn` response from these fields: it answers the peer identified by
 * {@link clientId} / {@link payloadId} and rebuilds the result array from
 * {@link indicesToSign} / {@link totalLength}.
 *
 * Present only for WalletConnect handoffs. Webview / deeplink / injected
 * handoffs deliver over their own transport (not the WC connector), and their
 * caller is gone after a kill anyway, so they carry no recovery context.
 */
export type WalletConnectHandoffRecovery = {
    clientId: string
    payloadId: number
    indicesToSign: number[]
    totalLength: number
}

/**
 * In-flight WalletConnect (or webview / deeplink / injected) sync-flow handoff.
 * Stashed by the multisig-propose transport at the moment the backend record is
 * created, so a later "threshold met" event can deliver the assembled signed
 * bytes to the dApp.
 *
 * Persisted (see {@link useWalletConnectHandoffsStore}) so a WalletConnect
 * handoff survives an app kill. The record is a hybrid: the live session
 * delivers via {@link callbacks} (transport-agnostic, works for every source);
 * those closures don't serialize, so a rehydrated handoff has none and the
 * resolver falls back to {@link recovery} — WalletConnect only.
 *
 * This module exposes thin imperative wrappers so non-React consumers (the
 * propose transport, the resolver delivery code) can register/unregister
 * without pulling in Zustand.
 */
export type PendingWalletConnectHandoff = {
    signRequestId: string
    /** Multisig account address. */
    multisigAddress: string
    /** Multisig metadata required to build the `msig` field. */
    msigMetadata: {
        version: number
        threshold: number
        addresses: string[]
    }
    /**
     * Base64-encoded raw (unprefixed) msgpack bytes of the transactions
     * exactly as the wallet proposed them — i.e. what the user reviewed
     * and the proposer signed. The resolver refuses to assemble/deliver
     * if the backend's `with-signatures` poll returns different bytes,
     * so a compromised backend can't swap in transactions nobody
     * reviewed.
     */
    expectedRawTransactionsBase64: string[]
    /** Device id for the `with-signatures` + `mark-confirmed` calls. */
    deviceId: string
    /**
     * Network the sign-request was created on. Captured here so the
     * resolver keeps polling the right backend even if the user switches
     * networks mid-flight.
     */
    network: Network
    /** Originating source type, for logging / telemetry. */
    sourceType: SourceType
    /**
     * The proposing participant's address, pinned at propose time. The only
     * local participant allowed to cancel the request on a terminal failure,
     * and the poll response can't be relied on for it: the backend declares
     * `proposer_address` optional and some deployments echo null. Persisted,
     * so a handoff resumed after an app kill can still cancel.
     */
    proposerAddress?: string
    /**
     * Timestamp of registration. Anchors the client-side handoff deadline
     * (PERA-4819); persisted, so a resumed-but-stale handoff self-expires on
     * relaunch instead of resuming a dead poll.
     */
    registeredAt: number
    /**
     * Live-session delivery closures — the transport-agnostic way to answer any
     * external source (WC connector, webview bridge, extension provider).
     * `approveSignedBytes` delivers the assembled signed bytes; `error` for
     * terminal failures; `reject({ kind: 'softReject', error })` for participant
     * decline / expired without a connection-error banner. Dropped when the
     * store persists (functions don't serialize), so a rehydrated handoff has
     * none and falls back to {@link recovery}.
     */
    callbacks?: Pick<SourceCallbacks, 'approveSignedBytes' | 'error' | 'reject'>
    /** WalletConnect-only serializable delivery context; drives post-kill recovery. */
    recovery?: WalletConnectHandoffRecovery
}

export const walletConnectHandoffs = {
    register: (handoff: PendingWalletConnectHandoff): void => {
        useWalletConnectHandoffsStore.getState().register(handoff)
    },
    unregister: (signRequestId: string): void => {
        useWalletConnectHandoffsStore.getState().unregister(signRequestId)
    },
    get: (signRequestId: string): PendingWalletConnectHandoff | undefined =>
        useWalletConnectHandoffsStore.getState().handoffs[signRequestId],
    list: (): PendingWalletConnectHandoff[] =>
        Object.values(useWalletConnectHandoffsStore.getState().handoffs),
    /** Test-only: drop every entry. Prefer the store's `resetState` directly when possible. */
    __resetForTests: (): void => {
        useWalletConnectHandoffsStore.getState().resetState()
    },
}
