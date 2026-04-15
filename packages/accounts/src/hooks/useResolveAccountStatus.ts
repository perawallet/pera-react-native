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

import { useCallback } from 'react'
import type { WalletAccount } from '../models'
import {
    resolveAccountStatus,
    resolveAuthAccount,
    canSignWithAccount,
    isSigningAccount,
    type AccountStatus,
} from '../utils'
import { useAllAccounts } from './useAllAccounts'
import { useAccountAuthAddresses } from './useAccountAuthAddresses'

type UseResolveAccountStatusResult = {
    resolveStatus: (account: WalletAccount) => AccountStatus
    resolveStatusByAddress: (address: string) => AccountStatus | null
    canSign: (account: WalletAccount) => boolean
    isSigning: (account: WalletAccount) => boolean
    getAuthAddress: (account: WalletAccount) => string | null
    resolveAuth: (account: WalletAccount) => WalletAccount
}

export const useResolveAccountStatus = (): UseResolveAccountStatusResult => {
    const accounts = useAllAccounts()
    const { authAddresses } = useAccountAuthAddresses()

    const getAuthAddress = useCallback(
        (account: WalletAccount): string | null => {
            return authAddresses.get(account.address) ?? null
        },
        [authAddresses],
    )

    const resolveStatus = useCallback(
        (account: WalletAccount): AccountStatus => {
            return resolveAccountStatus(
                account,
                accounts,
                authAddresses.get(account.address),
            )
        },
        [accounts, authAddresses],
    )

    const resolveStatusByAddress = useCallback(
        (address: string): AccountStatus | null => {
            const account = accounts.find(a => a.address === address)
            if (!account) return null
            return resolveAccountStatus(
                account,
                accounts,
                authAddresses.get(address),
            )
        },
        [accounts, authAddresses],
    )

    const canSign = useCallback(
        (account: WalletAccount): boolean => {
            return canSignWithAccount(account, accounts, authAddresses)
        },
        [accounts, authAddresses],
    )

    const isSigning = useCallback(
        (account: WalletAccount): boolean => {
            return isSigningAccount(
                account,
                accounts,
                authAddresses.get(account.address),
            )
        },
        [accounts, authAddresses],
    )

    const resolveAuth = useCallback(
        (account: WalletAccount): WalletAccount => {
            return resolveAuthAccount(
                account,
                accounts,
                authAddresses.get(account.address),
            )
        },
        [accounts, authAddresses],
    )

    return {
        resolveStatus,
        resolveStatusByAddress,
        canSign,
        isSigning,
        getAuthAddress,
        resolveAuth,
    }
}
