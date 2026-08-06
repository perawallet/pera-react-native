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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRoute, type RouteProp } from '@react-navigation/native'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useErrorToast } from '@hooks/useErrorToast'
import { useLanguage } from '@hooks/useLanguage'
import type { AddAccountStackParamList } from '@modules/onboarding/routes/types'
import {
    useHDWalletGroups,
    useCreateAccount,
    useAccountBalancesQuery,
    type HDWalletGroup,
    type AccountBalances,
} from '@perawallet/wallet-core-accounts'
import { deferToNextCycle } from '@perawallet/wallet-core-shared'

type UseSelectHDWalletScreenResult = {
    hdWalletGroups: HDWalletGroup[]
    accountBalances: AccountBalances
    isCreatingWallet: boolean
    /** A wallet is being selected and its next account built. */
    isSelectingWallet: boolean
    /** Exactly one wallet → skip the picker and auto-select it. */
    isAutoSelecting: boolean
    handleSelectWallet: (group: HDWalletGroup) => void
    handleCreateNewWallet: () => void
    handleGoBack: () => void
    t: (key: string, options?: Record<string, unknown>) => string
}

export const useSelectHDWalletScreen = (): UseSelectHDWalletScreenResult => {
    const navigation = useAppNavigation()
    const route =
        useRoute<RouteProp<AddAccountStackParamList, 'SelectHDWallet'>>()
    // Forwarded to NameAccount so a caller flow (e.g. Pera Card) resumes after naming.
    const returnTo = route.params?.returnTo
    const { t } = useLanguage()
    const { showError } = useErrorToast()
    const { hdWalletGroups } = useHDWalletGroups()
    const { buildHdWalletAccount } = useCreateAccount()
    const [isCreatingWallet, setIsCreatingWallet] = useState(false)
    const [isSelectingWallet, setIsSelectingWallet] = useState(false)
    // Set when auto-select fails, so the picker is revealed for a manual retry.
    const [autoSelectFailed, setAutoSelectFailed] = useState(false)
    const autoSelectedRef = useRef(false)

    const allGroupAccounts = useMemo(
        () => hdWalletGroups.flatMap(g => g.accounts),
        [hdWalletGroups],
    )

    const { accountBalances } = useAccountBalancesQuery(allGroupAccounts, true)

    const handleSelectWallet = useCallback(
        async (group: HDWalletGroup) => {
            setIsSelectingWallet(true)
            try {
                // Group is keyed by the bip39 seed id; siblings are the
                // accounts already grouped under it. Compute the next free
                // keyIndex on account 0 from the group itself rather than
                // re-filtering allAccounts (no need — the group already did).
                const nextKeyIndex =
                    group.accounts.length > 0
                        ? Math.max(
                              ...group.accounts.map(
                                  a => a.hdWalletDetails.keyIndex,
                              ),
                          ) + 1
                        : 0
                const newAccount = await buildHdWalletAccount({
                    walletId: group.seedKeyId,
                    account: 0,
                    keyIndex: nextKeyIndex,
                })
                navigation.replace('NameAccount', {
                    account: newAccount,
                    returnTo,
                })
            } catch (error) {
                // Reveal the picker for a manual retry instead of getting stuck.
                setAutoSelectFailed(true)
                setIsSelectingWallet(false)
                showError(error, t('onboarding.create_account.error_title'))
            }
        },
        [buildHdWalletAccount, navigation, returnTo, showError, t],
    )

    // A lone wallet makes the picker pointless — auto-select it.
    const isAutoSelecting = hdWalletGroups.length === 1 && !autoSelectFailed
    useEffect(() => {
        if (isAutoSelecting && !autoSelectedRef.current) {
            autoSelectedRef.current = true
            void handleSelectWallet(hdWalletGroups[0])
        }
    }, [isAutoSelecting, hdWalletGroups, handleSelectWallet])

    const handleCreateNewWallet = useCallback(() => {
        setIsCreatingWallet(true)
        void deferToNextCycle(async () => {
            try {
                const newAccount = await buildHdWalletAccount({
                    account: 0,
                    keyIndex: 0,
                })
                navigation.push('NameAccount', {
                    account: newAccount,
                    returnTo,
                })
            } catch (error) {
                showError(error, t('onboarding.create_account.error_title'))
            } finally {
                setIsCreatingWallet(false)
            }
        })
    }, [buildHdWalletAccount, navigation, showError, t, returnTo])

    const handleGoBack = useCallback(() => {
        navigation.goBack()
    }, [navigation])

    return {
        hdWalletGroups,
        accountBalances,
        isCreatingWallet,
        isSelectingWallet,
        isAutoSelecting,
        handleSelectWallet: (group: HDWalletGroup) =>
            void handleSelectWallet(group),
        handleCreateNewWallet,
        handleGoBack,
        t,
    }
}
