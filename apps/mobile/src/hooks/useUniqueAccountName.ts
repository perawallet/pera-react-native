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

import { useCallback, useMemo } from 'react'
import {
    useAllAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'

export type UseUniqueAccountNameResult = {
    /** Whether another account has `name`, ignoring case and surrounding spaces; an empty name is never taken. */
    isAccountNameTaken: (name: string, exceptAccountId?: string) => boolean
    /** Whether another account has the same name as `account`. */
    hasDuplicateName: (account: WalletAccount) => boolean
}

/** The form names are compared in: names differing only in case or surrounding spaces are the same. */
export const normalizeAccountName = (name: string) =>
    name.trim().normalize('NFC').toLowerCase()

export const useUniqueAccountName = (): UseUniqueAccountNameResult => {
    const accounts = useAllAccounts()

    const idsByName = useMemo(() => {
        const map = new Map<string, string[]>()
        for (const account of accounts) {
            const key = normalizeAccountName(account.name)
            map.set(key, [...(map.get(key) ?? []), account.id])
        }
        return map
    }, [accounts])

    const isAccountNameTaken = useCallback(
        (name: string, exceptAccountId?: string) => {
            const key = normalizeAccountName(name)
            if (key === '') return false
            return (idsByName.get(key) ?? []).some(
                id => exceptAccountId === undefined || id !== exceptAccountId,
            )
        },
        [idsByName],
    )

    const hasDuplicateName = useCallback(
        (account: WalletAccount) =>
            isAccountNameTaken(account.name, account.id),
        [isAccountNameTaken],
    )

    return { isAccountNameTaken, hasDuplicateName }
}
