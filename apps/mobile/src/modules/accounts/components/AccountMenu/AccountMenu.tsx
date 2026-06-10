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

import { PWFlatList, PWTouchableOpacity, PWView } from '@components/core'
import { type WalletAccount } from '@perawallet/wallet-core-accounts'
import { useStyles } from './styles'
import { AccountWithBalance } from '../AccountWithBalance'
import { AccountMenuHeader } from './AccountMenuHeader'
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
            <PWView style={styles.mainContent}>
                <PWFlatList<WalletAccount>
                    data={sortedAccounts}
                    extraData={sortMode}
                    keyExtractor={item => item.address}
                    renderItem={renderAccount}
                    ListHeaderComponent={
                        <AccountMenuHeader
                            headerContent={headerContent}
                            hideDefaultHeader={hideDefaultHeader}
                            isChartCollapsed={isChartCollapsed}
                            onExpandChart={handleExpandChart}
                            onOpenSort={onOpenSort}
                            onAddAccount={onAddAccount}
                        />
                    }
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
