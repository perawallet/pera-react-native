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

import { PWIcon, PWToolbar } from '@components/core'
import { AccountMenu } from '@modules/accounts/components/AccountMenu'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { WalletAccount } from '@perawallet/wallet-core-accounts'
import { ReactNode } from 'react'
import { useStyles } from './styles'

export type AccountMenuContentResult =
    | { kind: 'selected'; account: WalletAccount }
    | { kind: 'add-account' }
    | { kind: 'sort' }
    | { kind: 'search' }

export type AccountMenuContentProps = {
    headerContent?: ReactNode
    closeIconPosition?: 'left' | 'right'
    hideDefaultHeader?: boolean
    showSearch?: boolean
    accountFilter?: (account: WalletAccount) => boolean
}

export const AccountMenuContent = ({
    headerContent,
    closeIconPosition = 'right',
    hideDefaultHeader = false,
    showSearch = false,
    accountFilter,
}: AccountMenuContentProps) => {
    const styles = useStyles()
    const { resolve, dismiss } =
        useBottomSheetResult<AccountMenuContentResult>()

    const closeIcon = (
        <PWIcon
            name='cross'
            onPress={dismiss}
        />
    )

    const searchIcon = showSearch ? (
        <PWIcon
            name='magnifying-glass'
            onPress={() => resolve({ kind: 'search' })}
            testID='account_menu_search_button'
        />
    ) : undefined

    return (
        <>
            <PWToolbar
                left={closeIconPosition === 'left' ? closeIcon : searchIcon}
                right={closeIconPosition === 'right' ? closeIcon : searchIcon}
                paddingStyle='dense'
                style={styles.toolbar}
            />
            <AccountMenu
                onSelected={account => resolve({ kind: 'selected', account })}
                onAddAccount={() => resolve({ kind: 'add-account' })}
                onOpenSort={() => resolve({ kind: 'sort' })}
                headerContent={headerContent}
                hideDefaultHeader={hideDefaultHeader}
                accountFilter={accountFilter}
            />
        </>
    )
}
