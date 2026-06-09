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

import {
    PWButton,
    PWFlatList,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { type WalletAccount } from '@perawallet/wallet-core-accounts'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { AccountWithBalance } from '../AccountWithBalance'
import { PortfolioView } from '../PortfolioView'
import { useAccountMenu } from './useAccountMenu'
import { useCallback, type ReactNode } from 'react'

export type AccountMenuProps = {
    onSelected: (account: WalletAccount) => void
    onAddAccount: () => void
    onOpenSort: () => void
    headerContent?: ReactNode
    hideDefaultHeader?: boolean
    accountFilter?: (account: WalletAccount) => boolean
}

export const AccountMenu = (props: AccountMenuProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        sortedAccounts,
        selectedAccountAddress,
        sortMode,
        handleTap,
        isChartCollapsed,
        handleListScroll,
        handleExpandChart,
    } = useAccountMenu(props)
    const { onAddAccount, onOpenSort, headerContent, hideDefaultHeader } = props

    const renderAccount = useCallback(
        ({ item: acct }: { item: WalletAccount }) => (
            <PWTouchableOpacity onPress={() => handleTap(acct)}>
                <AccountWithBalance
                    account={acct}
                    isHighlighted={acct.address === selectedAccountAddress}
                />
            </PWTouchableOpacity>
        ),
        [handleTap, selectedAccountAddress],
    )

    return (
        <PWView style={styles.container}>
            {headerContent ?? (
                <PortfolioView
                    style={styles.portfolioContainer}
                    isCollapsed={isChartCollapsed}
                    onExpandChart={handleExpandChart}
                />
            )}

            <PWView style={styles.mainContent}>
                {!hideDefaultHeader && (
                    <PWView
                        style={styles.titleBar}
                        accessible={false}
                    >
                        <PWView style={styles.titleBarTitleContainer}>
                            <PWText
                                variant='h3'
                                style={styles.activeTitle}
                                truncate
                            >
                                {t('account_menu.title')}
                            </PWText>
                        </PWView>
                        <PWView
                            style={styles.titleBarButtonContainer}
                            accessible={false}
                        >
                            <PWButton
                                variant='linkPositive'
                                icon='list-arrow-down'
                                title={t('account_menu.sort')}
                                paddingStyle='dense'
                                onPress={onOpenSort}
                            />
                            <PWButton
                                testID='account_menu_add_account_button'
                                accessibilityLabel='account_menu_add_account_button'
                                variant='helper'
                                icon='plus'
                                paddingStyle='dense'
                                onPress={onAddAccount}
                            />
                        </PWView>
                    </PWView>
                )}

                <PWFlatList<WalletAccount>
                    data={sortedAccounts}
                    extraData={sortMode}
                    keyExtractor={item => item.address}
                    renderItem={renderAccount}
                    ItemSeparatorComponent={ListSeparator}
                    showsVerticalScrollIndicator={false}
                    onScroll={handleListScroll}
                    scrollEventThrottle={16}
                    inBottomSheet
                />
            </PWView>
        </PWView>
    )
}

const ListSeparator = () => {
    const styles = useStyles()

    return <PWView style={styles.listSeparator} />
}
