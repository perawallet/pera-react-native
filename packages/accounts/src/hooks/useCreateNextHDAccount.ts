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
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useAllAccounts } from './useAllAccounts'
import { useCreateAccount } from './useCreateAccount'
import type { WalletAccount } from '../models'
import { hdIndexOf, seedOf } from '../credentials'

type UseCreateNextHDAccountResult = {
    createNextHDAccount: () => Promise<Nullable<WalletAccount>>
    buildNextHDAccount: () => Promise<Nullable<WalletAccount>>
    hasHDWallet: boolean
}

/** The first HD wallet's id and the account index after its highest, or null with no HD wallet. */
const nextHdSlot = (
    hdAccounts: readonly WalletAccount[],
): Nullable<{ walletId: string; account: number }> => {
    if (hdAccounts.length === 0) return null
    // The seed (the wallet identifier) is the parent of each account's key.
    const walletId = seedOf(hdAccounts[0])
    if (!walletId) return null
    const indices = hdAccounts
        .filter(a => seedOf(a) === walletId)
        .flatMap(a => hdIndexOf(a)?.account ?? [])
    return { walletId, account: Math.max(...indices) + 1 }
}

export const useCreateNextHDAccount = (
    scope: ChainScope,
): UseCreateNextHDAccountResult => {
    const accounts = useAllAccounts()
    const { createHdWalletAccount, buildHdWalletAccount } =
        useCreateAccount(scope)

    const hdAccounts = useMemo(
        () => accounts.filter(a => hdIndexOf(a) !== undefined),
        [accounts],
    )

    const hasHDWallet = hdAccounts.length > 0

    const createNextHDAccount = useCallback(async () => {
        const slot = nextHdSlot(hdAccounts)
        return slot ? createHdWalletAccount({ ...slot, keyIndex: 0 }) : null
    }, [hdAccounts, createHdWalletAccount])

    const buildNextHDAccount = useCallback(async () => {
        const slot = nextHdSlot(hdAccounts)
        return slot ? buildHdWalletAccount({ ...slot, keyIndex: 0 }) : null
    }, [hdAccounts, buildHdWalletAccount])

    return { createNextHDAccount, buildNextHDAccount, hasHDWallet }
}
