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
    isQuantumAccount,
    useAllAccounts,
} from '@perawallet/wallet-core-accounts'
import {
    resolveAllSignerAddresses,
    type SignRequest,
} from '@perawallet/wallet-core-signing'
import type { Nullable } from '@perawallet/wallet-core-shared'

/**
 * ARC-60 and arbitrary-data signatures are ed25519-only in the current
 * protocol, so a Falcon signature from a quantum account would fail
 * verification on the dApp side. Block the request up front instead of
 * letting the user sign into a guaranteed failure. Remove once the
 * protocol gains PQ support.
 */
export const useIsQuantumDataSigningBlocked = (
    request: Nullable<SignRequest>,
): boolean => {
    const accounts = useAllAccounts()
    if (!request) return false

    // Block on the request's `signer` field (stdSigData.signer / data[].signer)
    // — not the SIWA account_address, and not the rekey-resolved auth account.
    // A request naming a quantum account as `signer` is caught here.
    //
    // The one case this can't see is an ARC-60 request whose keyless rekeyed
    // signer resolves to a quantum auth account. `canSignArc60` refuses a
    // quantum hop target outright, so such a request is rejected by the
    // transport before it is ever enqueued and never reaches this hook.
    return resolveAllSignerAddresses(request).some(address => {
        const account = accounts.find(a => a.address === address)
        return !!account && isQuantumAccount(account)
    })
}
