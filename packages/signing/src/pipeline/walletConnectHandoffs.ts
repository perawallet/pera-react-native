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
import type { SourceCallbacks, SourceMetadata } from './types'

/**
 * In-flight WalletConnect (or webview / deeplink) sync-flow handoff. Stashed
 * by the multisig-propose transport at the moment the backend record is
 * created, so a later "threshold met" event can pick up the callbacks and
 * deliver the assembled signed bytes to the dApp.
 *
 * Storage lives in {@link useWalletConnectHandoffsStore}; this module
 * exposes thin imperative wrappers so non-React consumers (the propose
 * transport, the resolver delivery code) can register/unregister without
 * pulling in Zustand.
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
    /**
     * The WC source callbacks. `approveSignedBytes` delivers the
     * assembled signed bytes (pre-encoded msgpack, original txn embedded
     * verbatim so participant signatures verify on algod). `error` for
     * terminal failures; `reject({ kind: 'softReject', error })` for
     * participant decline / expired without a connection-error banner.
     */
    callbacks: Pick<SourceCallbacks, 'approveSignedBytes' | 'error' | 'reject'>
    /** Forwarded source metadata, useful for logging / dedup. */
    source: SourceMetadata
    /** Timestamp of registration; for diagnostics. */
    registeredAt: number
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
