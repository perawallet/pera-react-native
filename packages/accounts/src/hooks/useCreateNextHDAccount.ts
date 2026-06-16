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
import { seedKeyIdFromDerivedKeyId, useKMS } from '@perawallet/wallet-core-kms'
import { useAllAccounts } from './useAllAccounts'
import { useCreateAccount } from './useCreateAccount'
import {
    AccountTypes,
    type HDWalletAccount,
    type WalletAccount,
} from '../models'
import type { Nullable } from '@perawallet/wallet-core-shared'

type UseCreateNextHDAccountResult = {
    createNextHDAccount: () => Promise<Nullable<WalletAccount>>
    buildNextHDAccount: () => Promise<Nullable<WalletAccount>>
    hasHDWallet: boolean
}

export const useCreateNextHDAccount = (): UseCreateNextHDAccountResult => {
    const accounts = useAllAccounts()
    const { createHdWalletAccount, buildHdWalletAccount } = useCreateAccount()
    const { seedIdOf } = useKMS()

    const hdWalletAccounts = useMemo(
        () =>
            accounts.filter(
                (a): a is HDWalletAccount => a.type === AccountTypes.hdWallet,
            ),
        [accounts],
    )

    const hasHDWallet = hdWalletAccounts.length > 0

    // Resolve a derived child's seed id, falling back to parsing the keyPairId
    // when the keystore snapshot is stale (so the build can't break).
    const resolveSeedId = useCallback(
        (keyPairId: string) =>
            seedIdOf(keyPairId) ?? seedKeyIdFromDerivedKeyId(keyPairId),
        [seedIdOf],
    )

    const createNextHDAccount = useCallback(async () => {
        if (hdWalletAccounts.length === 0) return null

        const firstHDAccount = hdWalletAccounts[0]
        // Account.keyPairId is the derived child id; the seed (i.e. the
        // wallet identifier) is its parent.
        const walletId = resolveSeedId(firstHDAccount.keyPairId)
        if (!walletId) return null

        const sameWalletAccounts = hdWalletAccounts.filter(
            a => resolveSeedId(a.keyPairId) === walletId,
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
    }, [hdWalletAccounts, createHdWalletAccount, resolveSeedId])

    const buildNextHDAccount = useCallback(async () => {
        if (hdWalletAccounts.length === 0) return null

        const firstHDAccount = hdWalletAccounts[0]
        const walletId = resolveSeedId(firstHDAccount.keyPairId)
        if (!walletId) return null

        const sameWalletAccounts = hdWalletAccounts.filter(
            a => resolveSeedId(a.keyPairId) === walletId,
        )
        const nextAccountIndex =
            Math.max(
                ...sameWalletAccounts.map(a => a.hdWalletDetails.account),
            ) + 1

        return buildHdWalletAccount({
            walletId,
            account: nextAccountIndex,
            keyIndex: 0,
        })
    }, [hdWalletAccounts, buildHdWalletAccount, resolveSeedId])

    return { createNextHDAccount, buildNextHDAccount, hasHDWallet }
}
