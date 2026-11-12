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
    resolveSignerForAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    hasSignerCredential,
    isArbitraryDataRequest,
    isAuthDataRequest,
    isTransactionRequest,
    isUnsignedTransactionRequest,
    type DelegatedUnsignableReason,
    type SignedFor,
    type SignRequest,
} from '@perawallet/wallet-core-signing'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { ALGORAND_CHAIN_ID } from '../chain-id'
import { algorandAddressOf } from '../accounts/vocabulary'
import { algorandRequestOf, algorandSigningSlotsOf } from './algorandRequest'
import { signingAccountOf } from './signingAccountFor'

// Every signer the request names, across all transactions/data entries — not
// just the first (a mixed group can hide its unsignable sender in a later
// slot). Unlike `resolveSignerAddress`, which serves the hardware overlay and
// deliberately returns one representative signer.
export const resolveAllSignerAddresses = (request: SignRequest): string[] => {
    if (isTransactionRequest(request)) {
        const algorand = algorandRequestOf(request)
        return (algorand?.txs ?? [])
            .map(
                (tx, index) =>
                    algorand?.signerOverrides?.get(index) ??
                    tx.sender?.toString?.(),
            )
            .filter((address): address is string => !!address)
    }
    if (isArbitraryDataRequest(request)) {
        return request.data
            .map(entry => entry.signer)
            .filter((address): address is string => !!address)
    }
    if (isAuthDataRequest(request)) {
        const signer = request.authData?.signer
        return signer ? [signer] : []
    }
    return []
}

/** `ReviewerChainAdapter.resolveSigningAccounts`, slot by slot as the planner keys them. */
export const resolveSigningAccounts = (
    request: SignRequest,
    accounts: WalletAccount[],
): WalletAccount[] => {
    const signers = signingSlotsOf(request).flatMap(
        slot => signingAccountOf(slot, accounts) ?? [],
    )
    return [...new Set(signers)]
}

// Data requests sign with the named account as the signed-for account.
const signingSlotsOf = (request: SignRequest): SignedFor[] => {
    if (!isTransactionRequest(request)) {
        return resolveAllSignerAddresses(request).map(address => ({
            address,
            isSigner: false,
        }))
    }
    if (!isUnsignedTransactionRequest(request)) return []
    return (algorandSigningSlotsOf(request) ?? []).map(slot => slot.signedFor)
}

type NamedSigner = { senderAddress: string; signer: string }

// Split by the planner's own rule (`algorandSigningSlotOf`): only a slot whose
// signer is named for it signs with that account's own key; every other slot
// signs for an account whose rekey is followed.
const splitTransactionSigners = (
    request: SignRequest,
): { signedFor: string[]; named: NamedSigner[] } => {
    if (!isTransactionRequest(request)) {
        return { signedFor: resolveAllSignerAddresses(request), named: [] }
    }
    const slots = isUnsignedTransactionRequest(request)
        ? algorandSigningSlotsOf(request)
        : null
    const signedFor: string[] = []
    const named: NamedSigner[] = []
    for (const { sender, signedFor: slot } of slots ?? []) {
        if (slot.isSigner) {
            named.push({ senderAddress: sender, signer: slot.address })
        } else {
            signedFor.push(slot.address)
        }
    }
    return { signedFor, named }
}

/**
 * Returns why a held sender in `request` cannot sign because of its rekey
 * state — its auth address is not in the wallet (`authMissing`) or is a
 * watch-only account (`authIsWatch`), or an account named to sign another's
 * transaction holds no key of its own (`authKeyMissing`) — or `null` when no
 * such sender exists.
 *
 * Lets the signing UI block the request up-front with a specific explanation
 * instead of letting the pipeline fail at machine init with a generic
 * "Signing failed". `multisig-cosign` requests pin a signable participant
 * and are excluded; senders not held in the wallet are skipped (they resolve
 * their own signability upstream).
 */
export const getRekeyedUnsignableReason = (
    request: SignRequest,
    accounts: WalletAccount[],
): Nullable<DelegatedUnsignableReason> => {
    if (request.sourceType === 'multisig-cosign') return null

    const { signedFor, named } = splitTransactionSigners(request)
    for (const { senderAddress, signer } of named) {
        const account = accounts.find(a => algorandAddressOf(a) === signer)
        if (account && !hasSignerCredential(account, ALGORAND_CHAIN_ID)) {
            return {
                kind: 'authKeyMissing',
                senderAddress,
                authAddress: signer,
            }
        }
    }

    for (const address of new Set(signedFor)) {
        const account = accounts.find(a => algorandAddressOf(a) === address)
        if (!account) continue
        const resolution = resolveSignerForAccount(
            account,
            accounts,
            ALGORAND_CHAIN_ID,
        )
        if (resolution.kind === 'authMissing') {
            return {
                kind: 'authMissing',
                senderAddress: address,
                authAddress: resolution.authorityAddress,
            }
        }
        if (resolution.kind === 'authIsWatch') {
            return {
                kind: 'authIsWatch',
                senderAddress: address,
                authAddress: algorandAddressOf(resolution.auth) ?? '',
            }
        }
    }
    return null
}
