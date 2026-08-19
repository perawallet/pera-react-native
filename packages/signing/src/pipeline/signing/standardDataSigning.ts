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
import type {
    ArbitraryDataSignableData,
    Arc60SignableData,
    SigningCallbacks,
    SigningResult,
} from '../types'
import { CannotSignError } from '../errors'

/**
 * Signing function type that matches useArbitraryDataSigner's signArbitraryData.
 * Shared by every strategy whose key material lives locally (Algo25, HD
 * Wallet, Quantum) — arbitrary-data signing has no strategy-specific
 * variance, only the underlying key operation differs.
 */
export type LocalArbitrarySigningFunction = (
    account: WalletAccount,
    data: string | string[],
) => Promise<Uint8Array[]>

/**
 * Signing function type that matches useLocalKeyArc60Signer's signArc60.
 * Shared by every strategy whose key material lives locally (Algo25, HD
 * Wallet, Quantum).
 */
export type LocalArc60SigningFunction = (
    account: WalletAccount,
    stdSigData: Arc60SignableData['stdSigData'],
    metadata: Arc60SignableData['metadata'],
) => Promise<Uint8Array>

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
    const mismatched = data.data.find(m => m.signer !== account.address)
    if (mismatched) {
        throw new CannotSignError(
            account.address,
            `Arbitrary-data item claims signer ${mismatched.signer} but is being signed by ${account.address}`,
        )
    }

    callbacks?.onSigningStart?.()
    const payloads = data.data.map(m => m.data)
    const signatures = await signArbitraryData(account, payloads)
    callbacks?.onSigningComplete?.()

    return {
        signedData: { type: 'arbitrary-data', signatures },
        signers: [{ address: account.address }],
        originalIndices,
    }
}

/**
 * Handles an `arc60` signable group for any strategy backed by a local-key
 * signing function. Domain / SIWA validation happens inside the injected
 * `signArc60` (see `utils/arc60.ts`'s `validateArc60AuthRequest`) — this
 * helper only wires the pipeline shapes.
 */
export const signArc60Case = async (
    data: Arc60SignableData,
    originalIndices: number[] | undefined,
    account: WalletAccount,
    signArc60: LocalArc60SigningFunction,
    callbacks?: SigningCallbacks,
): Promise<SigningResult> => {
    callbacks?.onSigningStart?.()
    const signature = await signArc60(account, data.stdSigData, data.metadata)
    callbacks?.onSigningComplete?.()

    return {
        signedData: { type: 'arc60', signature },
        signers: [{ address: account.address }],
        originalIndices,
    }
}
