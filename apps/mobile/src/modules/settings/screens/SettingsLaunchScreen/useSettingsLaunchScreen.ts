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
    chainAccountOf,
    LaunchAccountModes,
    useAccountsStore,
    useAllAccounts,
    type LaunchAccountMode,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'

export type UseSettingsLaunchScreenResult = {
    launchAccountMode: LaunchAccountMode
    /** The pinned account's address, for highlighting its row in the picker. */
    launchAccountAddress: Nullable<string>
    accounts: WalletAccount[]
    isAccountPickerVisible: boolean
    handleSelectLastUsed: () => void
    handleSelectSpecific: () => void
    handleSelectAccount: (account: WalletAccount) => void
}

export const useSettingsLaunchScreen = (): UseSettingsLaunchScreenResult => {
    const accounts = useAllAccounts()
    const launchAccountMode = useAccountsStore(state => state.launchAccountMode)
    const launchAccountId = useAccountsStore(state => state.launchAccountId)
    const launchAccountAddress = useMemo(() => {
        const pinned = accounts.find(account => account.id === launchAccountId)
        return pinned
            ? (chainAccountOf(pinned, LEGACY_CHAIN_ID)?.address ?? null)
            : null
    }, [accounts, launchAccountId])
    const setLaunchAccountPreference = useAccountsStore(
        state => state.setLaunchAccountPreference,
    )

    const handleSelectLastUsed = useCallback(() => {
        setLaunchAccountPreference(LaunchAccountModes.lastUsed)
    }, [setLaunchAccountPreference])

    // The store refuses `specific` without a resolvable account, so tapping the
    // radio pre-selects the currently pinned account, falling back to the first
    // account. Without that the radio would appear inert on first tap.
    const handleSelectSpecific = useCallback(() => {
        if (launchAccountMode === LaunchAccountModes.specific) return
        const fallback = launchAccountId ?? accounts.at(0)?.id
        setLaunchAccountPreference(LaunchAccountModes.specific, fallback)
    }, [
        accounts,
        launchAccountId,
        launchAccountMode,
        setLaunchAccountPreference,
    ])

    const handleSelectAccount = useCallback(
        (account: WalletAccount) => {
            setLaunchAccountPreference(LaunchAccountModes.specific, account.id)
        },
        [setLaunchAccountPreference],
    )

    return {
        launchAccountMode,
        launchAccountAddress,
        accounts,
        isAccountPickerVisible:
            launchAccountMode === LaunchAccountModes.specific,
        handleSelectLastUsed,
        handleSelectSpecific,
        handleSelectAccount,
    }
}
