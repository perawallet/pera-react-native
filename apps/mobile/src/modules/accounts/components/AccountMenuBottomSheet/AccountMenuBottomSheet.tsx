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

import { PWBottomSheet, PWIcon, PWToolbar } from '@components/core'
import { AccountMenu } from '@modules/accounts/components/AccountMenu'
import { WalletAccount } from '@perawallet/wallet-core-accounts'
import { ReactNode } from 'react'
import { useStyles } from './styles'

export type AccountMenuBottomSheetProps = {
    isVisible: boolean
    onClose: () => void
    onDismiss?: () => void
    onOpenSort: () => void
    onSelected: (account: WalletAccount) => void
    onAddAccount: () => void
    headerContent?: ReactNode
    closeIconPosition?: 'left' | 'right'
    hideDefaultHeader?: boolean
}

export const AccountMenuBottomSheet = ({
    isVisible,
    onClose,
    onDismiss,
    onOpenSort,
    onSelected,
    onAddAccount,
    headerContent,
    closeIconPosition = 'right',
    hideDefaultHeader = false,
}: AccountMenuBottomSheetProps) => {
    const styles = useStyles()

    const closeIcon = (
        <PWIcon
            name='cross'
            onPress={onClose}
        />
    )

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onBackdropPress={onClose}
            onDismiss={onDismiss}
            innerContainerStyle={styles.container}
            size='lg'
            autoCreateContainer={false}
        >
            <PWToolbar
                left={closeIconPosition === 'left' ? closeIcon : undefined}
                right={closeIconPosition === 'right' ? closeIcon : undefined}
                paddingStyle='dense'
            />
            <AccountMenu
                onSelected={onSelected}
                onAddAccount={onAddAccount}
                onOpenSort={onOpenSort}
                headerContent={headerContent}
                hideDefaultHeader={hideDefaultHeader}
            />
        </PWBottomSheet>
    )
}
