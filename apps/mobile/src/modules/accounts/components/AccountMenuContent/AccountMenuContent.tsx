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

import { PWIcon, PWView } from '@components/core'
import { SearchInputTrigger } from '@components/SearchInputTrigger'
import { AccountMenu } from '@modules/accounts/components/AccountMenu'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { ReactNode } from 'react'
import { useStyles } from './styles'

export type AccountMenuContentResult =
    | { kind: 'selected'; account: WalletAccount }
    | { kind: 'add-account' }
    | { kind: 'sort' }
    | { kind: 'search' }
    | { kind: 'pera-card-activate' }
    | { kind: 'pera-card-open' }

export type AccountMenuContentProps = {
    headerContent?: ReactNode
    hideDefaultHeader?: boolean
    showSearch?: boolean
    accountFilter?: (account: WalletAccount) => boolean
    /** Opt in to the Pera Card activation/connected row (home switcher only). */
    showPeraCardActivation?: boolean
    /** Controlled highlight forwarded to AccountMenu (see its `selectedAddress`). */
    selectedAddress?: Nullable<string>
}

export const AccountMenuContent = ({
    headerContent,
    hideDefaultHeader = false,
    showSearch = false,
    accountFilter,
    showPeraCardActivation = false,
    selectedAddress,
}: AccountMenuContentProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { resolve, dismiss } =
        useBottomSheetResult<AccountMenuContentResult>()

    return (
        <PWView style={styles.container}>
            <PWView style={styles.header}>
                {showSearch ? (
                    <PWView style={styles.searchTrigger}>
                        <SearchInputTrigger
                            onPress={() => resolve({ kind: 'search' })}
                            placeholder={t('search.placeholder')}
                            accessibilityLabel={t('search.placeholder')}
                            testID='account_menu_search_button'
                        />
                    </PWView>
                ) : null}
                <PWIcon
                    name='cross'
                    onPress={dismiss}
                    testID='account_menu_close_button'
                />
            </PWView>
            <AccountMenu
                onSelected={account => resolve({ kind: 'selected', account })}
                onAddAccount={() => resolve({ kind: 'add-account' })}
                onOpenSort={() => resolve({ kind: 'sort' })}
                onPeraCardActivate={() =>
                    resolve({ kind: 'pera-card-activate' })
                }
                onPeraCardOpen={() => resolve({ kind: 'pera-card-open' })}
                headerContent={headerContent}
                hideDefaultHeader={hideDefaultHeader}
                accountFilter={accountFilter}
                showPeraCardActivation={showPeraCardActivation}
                selectedAddress={selectedAddress}
            />
        </PWView>
    )
}
