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

import { useCallback, useRef, ReactNode } from 'react'
import {
    useSelectedAccount,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useStyles } from './styles'
import { AccountMenuBottomSheet } from '@modules/accounts/components/AccountMenuBottomSheet'
import { AccountSortBottomSheet } from '@modules/accounts/components/AccountSortBottomSheet'
import { useModalState } from '@hooks/useModalState'
import { useAppNavigation } from '@hooks/useAppNavigation'
import {
    StyleProp,
    TouchableOpacity,
    TouchableOpacityProps,
    ViewStyle,
} from 'react-native'
import { AccountDisplay } from '../AccountDisplay'
import { AccountIconProps } from '../AccountIcon'
import { PWTextProps } from '@components/core'

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
    const accountMenuState = useModalState()
    const sortSheetState = useModalState()
    const pendingSort = useRef(false)
    const navigation = useAppNavigation()

    const handleSelected = (selectedAccount: WalletAccount) => {
        accountMenuState.close()
        onSelected?.(selectedAccount)
    }

    const handleAddAccount = useCallback(() => {
        accountMenuState.close()
        navigation.navigate('AddAccount', { screen: 'AddAccountHome' })
    }, [accountMenuState, navigation])

    const handleOpenSort = useCallback(() => {
        pendingSort.current = true
        accountMenuState.close()
    }, [accountMenuState])

    const handleOpenSearch = useCallback(() => {
        accountMenuState.close()
        navigation.navigate('Search', { screen: 'SearchHome' })
    }, [accountMenuState, navigation])

    const handleAccountMenuDismissed = useCallback(() => {
        if (pendingSort.current) {
            pendingSort.current = false
            sortSheetState.open()
        }
    }, [sortSheetState])

    const handleSortClosed = useCallback(() => {
        sortSheetState.close()
        setTimeout(() => accountMenuState.open(), 100)
    }, [sortSheetState, accountMenuState])

    return (
        <>
            <TouchableOpacity
                {...props}
                activeOpacity={0.8}
                onPress={accountMenuState.open}
                testID='account_selection_button'
            >
                <AccountDisplay
                    account={account ?? undefined}
                    style={[styles.container, triggerStyle]}
                    iconProps={triggerIconProps}
                    textProps={triggerTextProps}
                    noBorder
                />
            </TouchableOpacity>
            <AccountMenuBottomSheet
                isVisible={accountMenuState.isOpen}
                onClose={accountMenuState.close}
                onDismiss={handleAccountMenuDismissed}
                onOpenSort={handleOpenSort}
                onOpenSearch={handleOpenSearch}
                onSelected={handleSelected}
                onAddAccount={handleAddAccount}
                headerContent={headerContent}
                closeIconPosition={closeIconPosition}
                hideDefaultHeader={hideDefaultHeader}
                accountFilter={accountFilter}
            />
            <AccountSortBottomSheet
                isVisible={sortSheetState.isOpen}
                onClose={handleSortClosed}
            />
        </>
    )
}
