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
    CannotSignError,
    type ArbitraryDataSignableData,
    type AuthDataSignableData,
    type LocalArbitrarySigningFunction,
    type LocalAuthDataSigningFunction,
    type SigningCallbacks,
    type SigningResult,
} from '@perawallet/wallet-core-signing'
import { algorandAddressOf } from '../../accounts/vocabulary'

const requireAlgorandAddress = (account: WalletAccount): string => {
    const address = algorandAddressOf(account)
    if (!address) {
        throw new CannotSignError(account.id, 'Account has no Algorand address')
    }
    return address
}

/**
 * Handles an `arbitrary-data` signable group for any strategy backed by a
 * local-key signing function (Algo25 / HD Wallet / Quantum — all three share
 * `createLocalKeyStrategy`). Extracted so the shared strategy doesn't
 * duplicate the signer-mismatch defense and result-shaping logic.
 *
 * Does not catch errors — the caller's try/catch wraps any failure
 * (including the mismatch guard below) into a `SigningError` uniformly.
 */
export const signArbitraryDataCase = async (
    data: ArbitraryDataSignableData,
    originalIndices: number[] | undefined,
    account: WalletAccount,
    signArbitraryData: LocalArbitrarySigningFunction,
    callbacks?: SigningCallbacks,
): Promise<SigningResult> => {
    // Defense in depth: never sign an item whose claimed signer differs
    // from the account producing the signature (the build step already
    // rejects mixed signers, but the signing key must never be applied to
    // data attributed to another account).
    const address = requireAlgorandAddress(account)
    const mismatched = data.data.find(m => m.signer !== address)
    if (mismatched) {
        throw new CannotSignError(
            address,
            `Arbitrary-data item claims signer ${mismatched.signer} but is being signed by ${address}`,
        )
    }

    callbacks?.onSigningStart?.()
    const payloads = data.data.map(m => m.data)
    const signatures = await signArbitraryData(account, payloads)
    callbacks?.onSigningComplete?.()

    return {
        signedData: { type: 'arbitrary-data', signatures },
        signers: [{ address }],
        originalIndices,
    }
}

/**
 * Handles an `auth-data` signable group for any strategy backed by a
 * local-key signing function. Domain / SIWA validation happens inside the
 * injected `signAuthData` (see `arc60.ts`'s `validateArc60AuthRequest`) — this
 * helper only wires the pipeline shapes.
 */
export const signAuthDataCase = async (
    data: AuthDataSignableData,
    originalIndices: number[] | undefined,
    account: WalletAccount,
    signAuthData: LocalAuthDataSigningFunction,
    callbacks?: SigningCallbacks,
): Promise<SigningResult> => {
    const address = requireAlgorandAddress(account)
    callbacks?.onSigningStart?.()
    const signature = await signAuthData(account, data.authData, data.metadata)
    callbacks?.onSigningComplete?.()

    return {
        signedData: { type: 'auth-data', signature },
        signers: [{ address }],
        originalIndices,
    }
}
