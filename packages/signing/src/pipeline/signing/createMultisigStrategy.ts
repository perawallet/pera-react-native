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
import {
    isMultisigAccount,
    resolveAuthAccount,
} from '@perawallet/wallet-core-accounts'
import { encodeToBase64, type Nullable } from '@perawallet/wallet-core-shared'
import type {
    SigningStrategy,
    SigningResult,
    SignerInfo,
    SignedData,
} from '../types'
import { NoLocalParticipantsError, SigningError } from '../errors'

export interface CreateMultisigStrategyOptions {
    /** Get local participants for a multisig account */
    getLocalParticipants: (
        account: WalletAccount,
        allAccounts: WalletAccount[],
    ) => WalletAccount[]

    /** Get signing strategy for an individual participant. Rekey indirection is intentionally NOT
     *  followed here — that's why no `allAccounts` is threaded through. */
    getStrategyForParticipant: (participant: WalletAccount) => SigningStrategy

    /** Get all user accounts */
    getAllAccounts: () => WalletAccount[]
}

/**
 * Creates a signing strategy for multisig accounts.
 * Signs with all local participants in parallel and combines results.
 */
export const createMultisigStrategy = (
    options: CreateMultisigStrategyOptions,
): SigningStrategy => {
    const { getLocalParticipants, getStrategyForParticipant, getAllAccounts } =
        options

    return {
        canSign: (account: WalletAccount): boolean => {
            return isMultisigAccount(account)
        },

        sign: async (group, account, callbacks) => {
            if (group.data.type === 'arbitrary-data') {
                throw new SigningError(
                    'Multisig signing of arbitrary data is not supported',
                )
            }

            if (group.data.type === 'arc60') {
                throw new SigningError(
                    'Multisig signing of ARC-60 requests is not supported',
                )
            }

            const allAccounts = getAllAccounts()
            const multisigAccount = resolveAuthAccount(account, allAccounts)
            const localParticipants = getLocalParticipants(
                multisigAccount,
                allAccounts,
            )

            if (localParticipants.length === 0) {
                throw new NoLocalParticipantsError(multisigAccount.address)
            }

            // Sign with each local participant in parallel
            const participantResults = await Promise.all(
                localParticipants.map(async participant => {
                    const strategy = getStrategyForParticipant(participant)
                    return strategy.sign(group, participant, callbacks)
                }),
            )

            return combineParticipantSignatures(participantResults)
        },
    }
}

/**
 * Combines signatures from multiple participants into a single result.
 *
 * Each participant's strategy produced its own signedData (single-sig
 * transactions over the same canonical bytes). To feed the multisig
 * propose/cosign backend, we lift each per-transaction signature into the
 * participant's `SignerInfo.signatures` array — these are the raw Ed25519
 * sigs the backend assembles into the composite multisig.
 *
 * The combined result keeps `signedData = firstResult.signedData` so any
 * downstream code that still expects a signed group sees a valid one
 * (the propose transport reads `signers` instead, but algod-fallback
 * paths or callback transports may still inspect signedData).
 */
const combineParticipantSignatures = (
    results: SigningResult[],
): SigningResult => {
    if (results.length === 0) {
        throw new SigningError('No participant results to combine')
    }

    const firstResult = results[0]
    const allSigners: SignerInfo[] = results.flatMap(r =>
        r.signers.map(signer => ({
            ...signer,
            signatures: extractSignatures(r.signedData),
        })),
    )

    return {
        signedData: firstResult.signedData,
        signers: allSigners,
    }
}

/**
 * Pulls per-transaction signature bytes out of a participant's signedData.
 * For our flow each participant signs as a single signer, so `sig` is set;
 * if a strategy ever produces an msig-shaped result we honor the first
 * non-null subsig as a fallback. Returns null for any txn that lacks both,
 * matching the backend schema shape `Array<Array<string | null>>`.
 */
const extractSignatures = (signedData: SignedData): Nullable<string>[] => {
    if (signedData.type !== 'transactions') {
        return []
    }
    return signedData.signed.map(stx => {
        // Quantum accounts aren't multisig participants today, and a
        // PQ-signed transaction has no `sig` (its signature lives in
        // `pqsig` instead) — this falls through to `null` for those slots
        // with no quantum-specific code.
        if (stx.sig) return encodeToBase64(stx.sig)
        const msigSig = stx.msig?.subsig.find(s => s.s)?.s
        if (msigSig) return encodeToBase64(msigSig)
        return null
    })
}
