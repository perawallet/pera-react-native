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

import { type WalletAccount } from '@perawallet/wallet-core-accounts'
import { type Nullable } from '@perawallet/wallet-core-shared'
import { PWFlatList, PWView } from '@components/core'
import { CopyableText } from '@components/CopyableText'
import { useStyles } from './styles'
import { AccountWithBalance } from '../AccountWithBalance'
import { PeraCardAccountItem } from '../PeraCardAccountItem'
import { AccountMenuHeader } from './AccountMenuHeader'
import { useAccountMenu, type AccountMenuListItem } from './useAccountMenu'
import { useCallback, type ReactNode } from 'react'

export type AccountMenuProps = {
    onSelected: (account: WalletAccount) => void
    onAddAccount: () => void
    onOpenSort: () => void
    headerContent?: ReactNode
    hideDefaultHeader?: boolean
    accountFilter?: (account: WalletAccount) => boolean
    /** Opt in to the Pera Card activation/connected row (home switcher only). */
    showPeraCardActivation?: boolean
    /** Fired when the Pera Card Activate button is tapped (host closes the menu and navigates). */
    onPeraCardActivate?: () => void
    /** Fired when an activated Pera Card row is tapped (host closes the menu and opens the card). */
    onPeraCardOpen?: () => void
    /**
     * Controlled highlight: when provided (even `null`), highlights this address
     * instead of the global selection, and tapping won't change the global account.
     */
    selectedAddress?: Nullable<string>
}

export const AccountMenu = (props: AccountMenuProps) => {
    const styles = useStyles()
    const { listItems, selectedAccountAddress, sortMode, handleTap } =
        useAccountMenu(props)
    const {
        onAddAccount,
        onOpenSort,
        onPeraCardActivate,
        onPeraCardOpen,
        headerContent,
        hideDefaultHeader,
    } = props

    const renderItem = useCallback(
        ({ item }: { item: AccountMenuListItem }) => {
            if (item.kind === 'pera-card') {
                return (
                    <PeraCardAccountItem
                        activated={item.activated}
                        nested={item.nested}
                        onActivate={onPeraCardActivate}
                        onOpen={onPeraCardOpen}
                    />
                )
            }

            const acct = item.account
            return (
                <CopyableText
                    copyValue={acct.address}
                    onPress={() => handleTap(acct)}
                    activeOpacity={0.8}
                    testID={`account_switcher_row_${acct.address}`}
                >
                    <AccountWithBalance
                        account={acct}
                        isHighlighted={acct.address === selectedAccountAddress}
                    />
                </CopyableText>
            )
        },
        [handleTap, selectedAccountAddress, onPeraCardActivate, onPeraCardOpen],
    )

    return (
        <PWView style={styles.container}>
            <PWView style={styles.mainContent}>
                <PWFlatList<AccountMenuListItem>
                    data={listItems}
                    extraData={sortMode}
                    keyExtractor={item =>
                        item.kind === 'account'
                            ? item.account.address
                            : 'pera-card'
                    }
                    renderItem={renderItem}
                    ListHeaderComponent={
                        <AccountMenuHeader
                            headerContent={headerContent}
                            hideDefaultHeader={hideDefaultHeader}
                            onOpenSort={onOpenSort}
                            onAddAccount={onAddAccount}
                        />
                    }
                    ItemSeparatorComponent={ListSeparator}
                    showsVerticalScrollIndicator={false}
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
