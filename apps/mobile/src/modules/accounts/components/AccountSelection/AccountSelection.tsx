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

import { useCallback, ReactNode } from 'react'
import {
    useSelectedAccount,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useStyles } from './styles'
import {
    AccountMenuContent,
    AccountMenuContentResult,
} from '@modules/accounts/components/AccountMenuContent'
import { AccountSortContent } from '@modules/accounts/components/AccountSortContent'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { StyleProp, TouchableOpacityProps, ViewStyle } from 'react-native'
import { AccountDisplay } from '../AccountDisplay'
import { AccountIconProps } from '../AccountIcon'
import { PWTextProps, PWTouchableOpacity } from '@components/core'

export type AccountSelectionProps = {
    onSelected?: (account: WalletAccount) => void
    headerContent?: ReactNode
    triggerStyle?: StyleProp<ViewStyle>
    triggerIconProps?: Omit<AccountIconProps, 'account'>
    triggerTextProps?: PWTextProps
    closeIconPosition?: 'left' | 'right'
    hideDefaultHeader?: boolean
    showSearch?: boolean
    accountFilter?: (account: WalletAccount) => boolean
} & TouchableOpacityProps

export const AccountSelection = ({
    onSelected,
    headerContent,
    triggerStyle,
    triggerIconProps,
    triggerTextProps,
    closeIconPosition,
    hideDefaultHeader,
    accountFilter,
    ...props
}: AccountSelectionProps) => {
    const styles = useStyles()
    const account = useSelectedAccount()
    const navigation = useAppNavigation()
    const { request: requestBottomSheet } = useBottomSheet()

    const openAccountMenu = useCallback(async () => {
        const result = await requestBottomSheet<AccountMenuContentResult>({
            contents: (
                <AccountMenuContent
                    headerContent={headerContent}
                    closeIconPosition={closeIconPosition}
                    hideDefaultHeader={hideDefaultHeader}
                    showSearch
                    accountFilter={accountFilter}
                />
            ),
            options: {
                size: 'lg',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })

        if (!result) return

        switch (result.kind) {
            case 'selected':
                onSelected?.(result.account)
                return
            case 'add-account':
                navigation.navigate('AddAccount', { screen: 'AddAccountHome' })
                return
            case 'search':
                navigation.navigate('Search', { screen: 'SearchScreen' })
                return
            case 'sort':
                await requestBottomSheet<void>({
                    contents: <AccountSortContent />,
                    options: { size: 'lg', enablePanDownToClose: true },
                })
                // After sorting, reopen the account menu so the user can pick.
                void openAccountMenu()
                return
        }
    }, [
        requestBottomSheet,
        headerContent,
        closeIconPosition,
        hideDefaultHeader,
        accountFilter,
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
                style={[styles.container, triggerStyle]}
                iconProps={triggerIconProps}
                textProps={triggerTextProps}
                noBorder
            />
        </PWTouchableOpacity>
    )
}
