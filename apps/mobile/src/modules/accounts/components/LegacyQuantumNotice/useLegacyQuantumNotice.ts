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
    useRekeyedAddressesQuery,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useKMS } from '@perawallet/wallet-core-kms'
import { isLegacyQuantumChild } from '@modules/accounts/utils/legacyQuantum'

export type UseLegacyQuantumNoticeResult = {
    isLegacyQuantumAccount: boolean
    /**
     * True whenever we have not proven this address is dependency-free —
     * on a fresh/loading lookup, an indexer error, or a real dependent.
     * Advising someone to abandon an account we could not verify is safe
     * risks stranding another account's only signer, so the softened copy
     * is the default and only clears once the lookup positively confirms
     * no dependents.
     */
    shouldUseDependentAwareCopy: boolean
}

/**
 * Backs the persistent marker on the account detail screen — the auto-opening
 * notification itself lives in the prompt queue (`useLegacyQuantumPrompt`),
 * wallet-level. This hook only decides whether *this* account should show the
 * marker at all and which copy it reopens with.
 */
export const useLegacyQuantumNotice = (
    account: WalletAccount,
): UseLegacyQuantumNoticeResult => {
    const { getKey } = useKMS()
    const isLegacyQuantumAccount = isLegacyQuantumChild(getKey, account)

    // Only probe the indexer for a legacy account — canonical and non-quantum
    // accounts never need this check, and an empty address disables the query.
    const {
        rekeyedAddresses,
        isLoading: isRekeyLookupLoading,
        isError: isRekeyLookupError,
    } = useRekeyedAddressesQuery(isLegacyQuantumAccount ? account.address : '')

    const hasProvenNoDependents =
        !isRekeyLookupLoading &&
        !isRekeyLookupError &&
        (rekeyedAddresses?.length ?? 0) === 0

    return {
        isLegacyQuantumAccount,
        shouldUseDependentAwareCopy:
            isLegacyQuantumAccount && !hasProvenNoDependents,
    }
}
