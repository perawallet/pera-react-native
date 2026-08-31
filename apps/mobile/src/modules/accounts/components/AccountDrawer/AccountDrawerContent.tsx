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

import { type ReactNode } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { type WalletAccount } from '@perawallet/wallet-core-accounts'
import { PWView } from '@components/core'
import { SearchInputTrigger } from '@components/SearchInputTrigger'
import { AccountMenu } from '@modules/accounts/components/AccountMenu'
import { useLanguage } from '@hooks/useLanguage'

import { useStyles } from './styles'

export type AccountDrawerContentProps = {
    onSelected: (account: WalletAccount) => void
    onAddAccount: () => void
    onSearch: () => void
    onOpenSort: () => void
    onPeraCardActivate: () => void
    onPeraCardOpen: () => void
    headerContent?: ReactNode
    hideDefaultHeader?: boolean
    showSearch?: boolean
    accountFilter?: (account: WalletAccount) => boolean
    showPeraCardActivation?: boolean
    isWithinSafeArea?: boolean
}

/**
 * The drawer panel's contents. There's no close control: the panel is dismissed
 * by swiping it away or tapping the exposed content beside it, so a screen
 * without a search trigger has no header row at all.
 */
export const AccountDrawerContent = ({
    onSelected,
    onAddAccount,
    onSearch,
    onOpenSort,
    onPeraCardActivate,
    onPeraCardOpen,
    headerContent,
    hideDefaultHeader = false,
    showSearch = false,
    accountFilter,
    showPeraCardActivation = false,
    isWithinSafeArea = false,
}: AccountDrawerContentProps) => {
    const insets = useSafeAreaInsets()
    const styles = useStyles({ topInset: isWithinSafeArea ? 0 : insets.top })
    const { t } = useLanguage()

    return (
        <PWView style={styles.container}>
            {showSearch && (
                <PWView style={styles.header}>
                    <PWView style={styles.searchTrigger}>
                        <SearchInputTrigger
                            onPress={onSearch}
                            placeholder={t('search.placeholder')}
                            accessibilityLabel={t('search.placeholder')}
                            testID='account_drawer_search_button'
                        />
                    </PWView>
                </PWView>
            )}
            <AccountMenu
                onSelected={onSelected}
                onAddAccount={onAddAccount}
                onOpenSort={onOpenSort}
                onPeraCardActivate={onPeraCardActivate}
                onPeraCardOpen={onPeraCardOpen}
                headerContent={headerContent}
                hideDefaultHeader={hideDefaultHeader}
                accountFilter={accountFilter}
                showPeraCardActivation={showPeraCardActivation}
            />
        </PWView>
    )
}
