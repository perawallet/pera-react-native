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

import {
    decodeFromBase64,
    encodeToBase64,
    generateOrderedUniqueId,
} from '@perawallet/wallet-core-shared'
import {
    canSignArc60,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    arc60PayloadSchema,
    type Arc60SignRequest,
    type PeraArbitraryDataSignResult,
} from '@perawallet/wallet-core-signing'
import type { LiquidAuthSession } from '../models'

/** Settles the ARC-0027 `sign_message` promise the dispatcher is awaiting. */
export type Arc60Callbacks = {
    approve: (signatures: string[]) => void
    reject: () => void
    error: (error: Error) => void
}

export type BuildArc60Input = {
    /** Raw ARC-0027 `sign_message` params (the ARC-60 StdSigData + Metadata). */
    params: unknown
    /** Session id (= the connect requestId) the request arrived on. */
    transportId: string
    sessions: LiquidAuthSession[]
    accounts: WalletAccount[]
    callbacks: Arc60Callbacks
}

/**
 * Validates an inbound ARC-60 sign-data request and builds the
 * `Arc60SignRequest` for the signing pipeline (which surfaces the review sheet
 * and delivers the signature back via the `callback` transport). Mirrors the
 * WalletConnect `handleArc60SignData` path, minus the WC-specific session
 * plumbing: validation uses the shared `arc60PayloadSchema`, the signer must be
 * a connected account for this session, and it must be ARC-60-signable
 * (local-key or hardware — not watch/multisig).
 *
 * Returns the request to enqueue, or `null` after surfacing a precise error to
 * the dApp via `callbacks.error` (so the caller just `addSignRequest`s a
 * non-null result).
 */
export const buildArc60SignRequest = ({
    params,
    transportId,
    sessions,
    accounts,
    callbacks,
}: BuildArc60Input): Arc60SignRequest | null => {
    const parsed = arc60PayloadSchema.safeParse(params)
    if (!parsed.success) {
        const summary = parsed.error.issues
            .map(
                issue =>
                    `${issue.path.join('.') || '(root)'}: ${issue.message}`,
            )
            .join('; ')
        callbacks.error(
            new Error(`Invalid ARC-60 sign request payload — ${summary}`),
        )
        return null
    }
    const {
        data,
        signer,
        domain,
        authenticatorData,
        requestId,
        hdPath,
        metadata,
    } = parsed.data

    const session = sessions.find(item => item.sessionId === transportId)
    if (!session?.accounts.includes(signer)) {
        callbacks.error(new Error('Signer is not connected for this session'))
        return null
    }
    const account = accounts.find(item => item.address === signer)
    if (!account || !canSignArc60(account)) {
        callbacks.error(new Error('Signer cannot sign ARC-60 payloads'))
        return null
    }

    let decodedAuthData: Uint8Array
    try {
        decodedAuthData = decodeFromBase64(authenticatorData)
    } catch {
        callbacks.error(new Error('`authenticatorData` is not valid base64'))
        return null
    }

    return {
        id: generateOrderedUniqueId(),
        type: 'arc60',
        transport: 'callback',
        sourceType: 'liquidauth',
        transportId,
        sourceMetadata: session.peerMeta,
        stdSigData: {
            data,
            signer,
            domain,
            authenticatorData: decodedAuthData,
            requestId,
            hdPath,
        },
        metadata,
        // ARC-60 yields a single signature; deliver it base64-encoded (matching
        // the legacy algo_signData array shape) back over the data channel.
        approve: async (signed: PeraArbitraryDataSignResult[]) => {
            callbacks.approve(
                signed.map(item => encodeToBase64(item.signature)),
            )
        },
        reject: async () => callbacks.reject(),
        error: async (error: Error) => callbacks.error(error),
    } as Arc60SignRequest
}
