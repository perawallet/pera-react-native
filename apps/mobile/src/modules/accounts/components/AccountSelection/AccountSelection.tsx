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

import { useCallback, type ReactNode } from 'react'
import {
    useSelectedAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { hasCardSession, useCardStore } from '@perawallet/wallet-core-card'
import { useStyles } from './styles'
import {
    AccountMenuContent,
    type AccountMenuContentResult,
} from '@modules/accounts/components/AccountMenuContent'
import { AccountSortContent } from '@modules/accounts/components/AccountSortContent'
import { useBottomSheet } from '@modules/bottom-sheet'
import { trackEvent, HomeEvent } from '@analytics'
import { useAppNavigation } from '@hooks/useAppNavigation'
import {
    type StyleProp,
    type TouchableOpacityProps,
    type ViewStyle,
} from 'react-native'
import { AccountDisplay, type AccountDisplayCard } from '../AccountDisplay'
import { type AccountIconProps } from '../AccountIcon'
import {
    type PWIconProps,
    type PWTextProps,
    PWTouchableOpacity,
} from '@components/core'

export type AccountSelectionProps = {
    onSelected?: (account: WalletAccount) => void
    headerContent?: ReactNode
    /**
     * When set, the trigger renders the Pera Card identity instead of the
     * selected account (the switcher still opens on tap).
     */
    card?: AccountDisplayCard
    triggerStyle?: StyleProp<ViewStyle>
    triggerIconProps?: Omit<AccountIconProps, 'account'>
    triggerChevronProps?: Partial<PWIconProps>
    triggerTextProps?: PWTextProps
    hideDefaultHeader?: boolean
    showSearch?: boolean
    accountFilter?: (account: WalletAccount) => boolean
    /** Opt in to the Pera Card activation/connected row (home switcher only). */
    showPeraCardActivation?: boolean
} & TouchableOpacityProps

export const AccountSelection = ({
    onSelected,
    headerContent,
    card,
    triggerStyle,
    triggerIconProps,
    triggerChevronProps,
    triggerTextProps,
    hideDefaultHeader,
    showSearch = false,
    accountFilter,
    showPeraCardActivation,
    ...props
}: AccountSelectionProps) => {
    const styles = useStyles()
    const account = useSelectedAccount()
    const navigation = useAppNavigation()
    const { request: requestBottomSheet } = useBottomSheet()

    const openAccountMenu = useCallback(async () => {
        const result = await requestBottomSheet<AccountMenuContentResult>({
            id: 'account-selection-menu',
            contents: (
                <AccountMenuContent
                    headerContent={headerContent}
                    hideDefaultHeader={hideDefaultHeader}
                    showSearch={showSearch}
                    accountFilter={accountFilter}
                    showPeraCardActivation={showPeraCardActivation}
                />
            ),
            options: {
                size: 'modal',
                enablePanDownToClose: false,
                enableContentPanningGesture: false,
                autoCreateContainer: false,
            },
        })

        if (!result) return

        switch (result.kind) {
            case 'selected': {
                onSelected?.(result.account)
                return
            }
            case 'add-account': {
                trackEvent(HomeEvent.AccountAdd)
                navigation.navigate('AddAccount', { screen: 'AddAccountHome' })
                return
            }
            case 'search': {
                navigation.navigate('Search', { screen: 'SearchScreen' })
                return
            }
            case 'pera-card-activate': {
                navigation.navigate('PeraCard', { screen: 'PeraCardIntro' })
                return
            }
            case 'pera-card-open': {
                // The connected row shows off the persisted auth flag, which can
                // outlive the real session — require a live token, else log in.
                if (!hasCardSession()) {
                    navigation.navigate('PeraCard', { screen: 'CardSignIn' })
                    return
                }
                // Baanx auth finishing doesn't mean the escrow card itself was
                // ever created/approved — send an authenticated-but-incomplete
                // user back into the setup checklist rather than the dashboard.
                const { escrowCardAddress, escrowCardApproved } =
                    useCardStore.getState()
                if (!escrowCardAddress || !escrowCardApproved) {
                    navigation.navigate('PeraCard', {
                        screen: 'CardOnboarding',
                        params: { screen: 'CardOnboardingStatus', params: {} },
                    })
                    return
                }
                navigation.navigate('TabBar', {
                    screen: 'Home',
                    params: { screen: 'PeraCardAccount' },
                })
                return
            }
            case 'sort': {
                trackEvent(HomeEvent.Sort)
                await requestBottomSheet<void>({
                    contents: <AccountSortContent />,
                    options: {
                        size: 'modal',
                        enablePanDownToClose: false,
                        enableContentPanningGesture: false,
                        autoCreateContainer: false,
                    },
                })
                // After sorting, reopen the account menu so the user can pick.
                void openAccountMenu()
                return
            }
        }
    }, [
        requestBottomSheet,
        headerContent,
        hideDefaultHeader,
        showSearch,
        accountFilter,
        showPeraCardActivation,
        onSelected,
        navigation,
    ])

    return (
        <PWTouchableOpacity
            {...props}
            style={[styles.trigger, props.style]}
            activeOpacity={0.8}
            onPress={() => {
                void openAccountMenu()
            }}
            testID='account_selection_button'
        >
            <AccountDisplay
                account={account ?? undefined}
                card={card}
                style={[styles.container, triggerStyle]}
                iconProps={triggerIconProps}
                chevronProps={triggerChevronProps}
                textProps={triggerTextProps}
                noBorder
            />
        </PWTouchableOpacity>
    )
}
