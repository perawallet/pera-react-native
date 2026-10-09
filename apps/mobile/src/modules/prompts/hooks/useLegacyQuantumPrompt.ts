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

import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import {
    fetchRekeyedAddresses,
    addressOn,
    getRekeyedAddressesQueryKey,
    useAllAccounts,
} from '@perawallet/wallet-core-accounts'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { useKMS } from '@perawallet/wallet-core-kms'
import { isLegacyQuantumChild } from '@modules/accounts'

export type UseLegacyQuantumPromptResult = {
    /** The wallet holds at least one legacy-derivation quantum account. */
    isDue: boolean
    /**
     * The prompt is wallet-level, but the caution is per-account: if ANY
     * legacy account's dependency status is unproven — still loading,
     * errored, or a genuine dependent — the whole prompt uses the cautious
     * wording. Over-caution across a few clean accounts is far cheaper than
     * one user abandoning an account that is another account's only signer.
     */
    shouldUseDependentAwareCopy: boolean
}

export const useLegacyQuantumPrompt = (): UseLegacyQuantumPromptResult => {
    const accounts = useAllAccounts()
    const { getKey } = useKMS()
    const scope = useSelectedScope(LEGACY_CHAIN_ID)

    const legacyAddresses = useMemo(
        () =>
            accounts
                .filter(account =>
                    isLegacyQuantumChild(getKey, account, scope.chainId),
                )
                .flatMap(account => addressOn(account, scope) ?? []),
        [accounts, getKey, scope],
    )

    // Shares its query key with `useRekeyedAddressesQuery` (the per-account
    // marker's own lookup), so a prior fetch for the same address is reused
    // instead of doubling the indexer round-trip.
    const lookups = useQueries({
        queries: legacyAddresses.map(address => ({
            queryKey: getRekeyedAddressesQueryKey(address, scope),
            queryFn: () => fetchRekeyedAddresses(address, scope),
            staleTime: 30_000,
        })),
    })

    const shouldUseDependentAwareCopy = lookups.some(
        lookup => !lookup.isSuccess || (lookup.data?.length ?? 0) > 0,
    )

    return {
        isDue: legacyAddresses.length > 0,
        shouldUseDependentAwareCopy,
    }
}
