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

import { useCallback, useEffect, useRef } from 'react'
import { useIsFocused, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
    hasCardSession,
    setCardFundingSourceAddress,
    useCardOwnerAddressQuery,
    useRestoreEscrowCardMutation,
} from '@perawallet/wallet-core-card'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    useCardErrorToast,
    useCardOnboardingLogout,
    useOpenCardSupport,
} from '@modules/card/hooks'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useCardScope } from '../../hooks/useCardScope'
import type { CardOnboardingStackParamList } from '../../routes/card-onboarding/types'
import { cardAccountAddressOf } from '../../utils/cardAccountAddress'

export type UseCardOnOtherAccountScreenResult = {
    /** The account the card is bound to, once Baanx and the chain answer. */
    ownerAddress: Nullable<string>
    isCheckingAgain: boolean
    /** Looks the card up again, for after the user adds the missing account. */
    handleCheckAgain: () => void
    handleLogout: () => void
    handleOpenSupport: () => void
}

export const useCardOnOtherAccountScreen =
    (): UseCardOnOtherAccountScreenResult => {
        const scope = useCardScope()
        const { t } = useLanguage()
        const { infoToast } = useToast()
        const showCardError = useCardErrorToast()
        const navigation = useAppNavigation()
        const isFocused = useIsFocused()
        const accounts = useAllAccounts()
        const { handleLogout } = useCardOnboardingLogout()
        const handleOpenSupport = useOpenCardSupport()

        const { ownerAddress } = useCardOwnerAddressQuery(scope)
        const restore = useRestoreEscrowCardMutation(scope)
        const restoreAsync = restore.mutateAsync

        const findCardInWallet = useCallback(
            async (isUserInitiated: boolean) => {
                const addresses = accounts.flatMap(
                    account =>
                        cardAccountAddressOf(account, scope.chainId) ?? [],
                )
                let cardAddress: Nullable<string>
                try {
                    cardAddress = await restoreAsync(addresses)
                } catch (error) {
                    if (isUserInitiated && navigation.isFocused()) {
                        void showCardError(error)
                    }
                    return
                }
                // The user may have logged out or left while the lookup ran.
                if (!navigation.isFocused() || !hasCardSession()) return
                if (cardAddress !== null) {
                    navigation.navigate('TabBar', {
                        screen: 'Home',
                        params: { screen: 'PeraCardAccount' },
                    })
                    return
                }
                if (isUserInitiated) {
                    infoToast(
                        t('peraCard.card_on_other_account.not_found_title'),
                        t('peraCard.card_on_other_account.not_found_body'),
                    )
                }
            },
            [
                accounts,
                scope.chainId,
                restoreAsync,
                navigation,
                showCardError,
                infoToast,
                t,
            ],
        )

        // The user may come back after adding the account, so look on every
        // visit. A locally picked account would otherwise show the card nested
        // under it in the account list.
        const hasLookedThisVisit = useRef(false)
        useEffect(() => {
            if (!isFocused) {
                hasLookedThisVisit.current = false
                return
            }
            if (hasLookedThisVisit.current) return
            hasLookedThisVisit.current = true
            setCardFundingSourceAddress(null)
            void findCardInWallet(false)
        }, [isFocused, findCardInWallet])

        // Back would land on the checklist, which only sends the user here
        // again, so it leaves for the wallet home instead.
        const stackNavigation =
            useNavigation<
                NativeStackNavigationProp<
                    CardOnboardingStackParamList,
                    'CardOnOtherAccount'
                >
            >()
        useEffect(() => {
            const unsubscribe = stackNavigation.addListener(
                'beforeRemove',
                event => {
                    const { type } = event.data.action
                    if (type !== 'GO_BACK' && type !== 'POP') return
                    event.preventDefault()
                    navigation.navigate('TabBar', { screen: 'Home' })
                },
            )
            return unsubscribe
        }, [stackNavigation, navigation])

        const handleCheckAgain = useCallback(() => {
            if (restore.isPending) return
            void findCardInWallet(true)
        }, [restore.isPending, findCardInWallet])

        return {
            ownerAddress,
            isCheckingAgain: restore.isPending,
            handleCheckAgain,
            handleLogout,
            handleOpenSupport,
        }
    }
