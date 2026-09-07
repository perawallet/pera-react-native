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
import type { HDWalletAccount } from '../models'
import { isHDWalletAccount } from '../utils'

export type HDWalletGroup = {
    /** Keystore id of the bip39 seed that backs every account in the group. */
    seedKeyId: string
    accounts: HDWalletAccount[]
    firstAccount: HDWalletAccount
    accountCount: number
}

type UseHDWalletGroupsResult = {
    hdWalletGroups: HDWalletGroup[]
    hasMultipleHDWallets: boolean
}

export const useHDWalletGroups = (): UseHDWalletGroupsResult => {
    const accounts = useAllAccounts()
    const { seedIdOf } = useKMS()

    const hdWalletGroups = useMemo(() => {
        const hdAccounts = accounts.filter(isHDWalletAccount)

        // Each HD account's `keyPairId` is its own derived child key id.
        // The seed parent is reachable via `seedIdOf` (which walks
        // `metadata.parentKeyId`); group by seed so sibling accounts on
        // the same wallet land together.
        const groupMap = new Map<string, HDWalletAccount[]>()
        for (const account of hdAccounts) {
            const seedKeyId = seedIdOf(account.keyPairId)
            if (!seedKeyId) continue
            const existing = groupMap.get(seedKeyId) ?? []
            existing.push(account)
            groupMap.set(seedKeyId, existing)
        }

        return Array.from(groupMap.entries()).map(
            ([seedKeyId, groupAccounts]): HDWalletGroup => ({
                seedKeyId,
                accounts: groupAccounts,
                firstAccount: groupAccounts[0],
                accountCount: groupAccounts.length,
            }),
        )
    }, [accounts, seedIdOf])

    return {
        hdWalletGroups,
        hasMultipleHDWallets: hdWalletGroups.length > 1,
    }
}
