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
    findAccountByAddressOn,
    useAllAccounts,
} from '@perawallet/wallet-core-accounts'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import {
    isAuthDataRequest,
    messageSignerChainAdapters,
    resolveAllSignerAddresses,
    type SignRequest,
} from '@perawallet/wallet-core-signing'
import type { Nullable } from '@perawallet/wallet-core-shared'

/**
 * Blocks a data-signing request up front when the requester couldn't verify
 * the signature (a key of a scheme the message format doesn't carry), instead
 * of letting the user sign into a guaranteed failure.
 */
export const useIsQuantumDataSigningBlocked = (
    request: Nullable<SignRequest>,
): boolean => {
    const accounts = useAllAccounts()
    if (!request) return false

    // Block on the request's `signer` field (authData.signer / data[].signer),
    // not the sign-in message address. Data signing uses the named signer's own
    // key and never follows a rekey, so that is the only key in play. An
    // account rekeyed to an unverifiable auth can't sign in at all: naming
    // itself is refused by the chain's auth-data validation (control moved to
    // the auth), and naming the auth lands here.
    const signer = messageSignerChainAdapters.get(LEGACY_CHAIN_ID)
    const kind = isAuthDataRequest(request) ? 'authData' : 'arbitraryData'
    return resolveAllSignerAddresses(LEGACY_CHAIN_ID, request).some(address => {
        const account = findAccountByAddressOn(
            accounts,
            LEGACY_CHAIN_ID,
            address,
        )
        return !!account && !signer.signsVerifiably(account, kind)
    })
}
