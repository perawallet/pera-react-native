/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { useAllAccounts } from './useAllAccounts'
import { HDWalletAccount } from '../models'
import { isHDWalletAccount } from '../utils'

export type HDWalletGroup = {
    keyPairId: string
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

    const hdWalletGroups = useMemo(() => {
        const hdAccounts = accounts.filter(isHDWalletAccount)

        const groupMap = new Map<string, HDWalletAccount[]>()
        for (const account of hdAccounts) {
            const existing = groupMap.get(account.keyPairId) ?? []
            existing.push(account)
            groupMap.set(account.keyPairId, existing)
        }

        return Array.from(groupMap.entries()).map(
            ([keyPairId, groupAccounts]): HDWalletGroup => ({
                keyPairId,
                accounts: groupAccounts,
                firstAccount: groupAccounts[0],
                accountCount: groupAccounts.length,
            }),
        )
    }, [accounts])

    return {
        hdWalletGroups,
        hasMultipleHDWallets: hdWalletGroups.length > 1,
    }
}
