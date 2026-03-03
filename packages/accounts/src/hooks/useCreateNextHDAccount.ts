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

import { useCallback, useMemo } from 'react'
import { useAllAccounts } from './useAllAccounts'
import { useCreateAccount } from './useCreateAccount'
import { AccountTypes, HDWalletAccount, WalletAccount } from '../models'

type UseCreateNextHDAccountResult = {
    createNextHDAccount: () => Promise<WalletAccount | null>
    hasHDWallet: boolean
}

export const useCreateNextHDAccount = (): UseCreateNextHDAccountResult => {
    const accounts = useAllAccounts()
    const { createHdWalletAccount } = useCreateAccount()

    const hdWalletAccounts = useMemo(
        () =>
            accounts.filter(
                (a): a is HDWalletAccount => a.type === AccountTypes.hdWallet,
            ),
        [accounts],
    )

    const hasHDWallet = hdWalletAccounts.length > 0

    const createNextHDAccount = useCallback(async () => {
        if (hdWalletAccounts.length === 0) return null

        const firstHDAccount = hdWalletAccounts[0]
        const walletId = firstHDAccount.keyPairId

        const sameWalletAccounts = hdWalletAccounts.filter(
            a => a.keyPairId === walletId,
        )
        const nextAccountIndex =
            Math.max(
                ...sameWalletAccounts.map(a => a.hdWalletDetails.account),
            ) + 1

        return createHdWalletAccount({
            walletId,
            account: nextAccountIndex,
            keyIndex: 0,
        })
    }, [hdWalletAccounts, createHdWalletAccount])

    return { createNextHDAccount, hasHDWallet }
}
