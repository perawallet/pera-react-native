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
import { useKMS } from '@perawallet/wallet-core-kms'
import { useAllAccounts } from './useAllAccounts'
import type { LocalAccount } from '../models'
import { hasCustody, hdIndexOf, seedOf } from '../credentials'

export type HdSeedGroup = {
    /** Keystore id of the bip39 seed that backs every account in the group. */
    seedKeyId: string
    accounts: LocalAccount[]
    firstAccount: LocalAccount
    accountCount: number
}

type UseHdSeedGroupsResult = {
    hdSeedGroups: HdSeedGroup[]
    hasMultipleHdSeeds: boolean
}

export const useHdSeedGroups = (): UseHdSeedGroupsResult => {
    const accounts = useAllAccounts()
    // Recomputes when the keystore loads, since `seedOf` reads it.
    const { keys: seeds } = useKMS()

    const hdSeedGroups = useMemo(() => {
        const hdAccounts = accounts.filter(
            (account): account is LocalAccount =>
                hasCustody(account, 'local') &&
                hdIndexOf(account) !== undefined,
        )

        // Each HD account's key is its own derived child; the seed parent is
        // reachable via `seedOf`, so group by seed and sibling accounts on the
        // same wallet land together.
        const groupMap = new Map<string, LocalAccount[]>()
        for (const account of hdAccounts) {
            const seedKeyId = seedOf(account)
            if (!seedKeyId) continue
            const existing = groupMap.get(seedKeyId) ?? []
            existing.push(account)
            groupMap.set(seedKeyId, existing)
        }

        return Array.from(groupMap.entries()).map(
            ([seedKeyId, groupAccounts]): HdSeedGroup => ({
                seedKeyId,
                accounts: groupAccounts,
                firstAccount: groupAccounts[0],
                accountCount: groupAccounts.length,
            }),
        )
        // oxlint-disable-next-line react-hooks/exhaustive-deps -- `seeds` only invalidates the memo
    }, [accounts, seeds])

    return {
        hdSeedGroups,
        hasMultipleHdSeeds: hdSeedGroups.length > 1,
    }
}
