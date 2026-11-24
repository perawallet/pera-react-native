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
import {
    getAccountDisplayName,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useSwapAccountsAddresses } from './useSwapAccountsAddresses'

export type SwapAccountName = { accountId: string; name: string }

export type UseSwapAccountNamesResult = {
    /** Each of `accounts` that has an address on a swap chain, by the name every Swap surface shows it under. */
    names: SwapAccountName[]
    /** More than one of `accounts` has a swap address, so telling them apart is worth the space. */
    isMultiAccount: boolean
}

/**
 * One name per account, spelled on its first swap chain, so an unnamed
 * account's truncated address reads the same on a chip, a filter and a row.
 */
export const useSwapAccountNames = (
    accounts: readonly WalletAccount[],
): UseSwapAccountNamesResult => {
    const addresses = useSwapAccountsAddresses(accounts)
    return useMemo(() => {
        const names = accounts.flatMap(account => {
            const first = addresses.find(
                entry => entry.accountId === account.id,
            )
            return first
                ? [
                      {
                          accountId: account.id,
                          name: getAccountDisplayName(
                              account,
                              first.scope.chainId,
                          ),
                      },
                  ]
                : []
        })
        return { names, isMultiAccount: names.length > 1 }
    }, [accounts, addresses])
}
