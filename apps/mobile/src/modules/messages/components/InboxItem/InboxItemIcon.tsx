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

import { PWIcon, PWView } from '@components/core'
import type { InboxItem } from '@perawallet/wallet-core-notifications'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { AccountIcon } from '@modules/accounts/components/AccountIcon'
import { useStyles } from './styles'

type InboxItemIconProps = {
    item: InboxItem
}

export const InboxItemIcon = ({ item }: InboxItemIconProps) => {
    const styles = useStyles()
    const accounts = useAllAccounts()

    switch (item.type) {
        case 'asa_inbox': {
            const account = accounts.find(
                acc => acc.address === item.data.address,
            )
            if (!account) {
                return (
                    <PWIcon
                        name='inbox'
                        variant='secondary'
                        size='lg'
                    />
                )
            }
            return (
                <AccountIcon
                    account={account}
                    size='lg'
                />
            )
        }
        case 'joint_account_import':
            return (
                <PWView style={styles.iconContainer}>
                    <PWIcon
                        name='transactions/group'
                        variant='secondary'
                        size='lg'
                    />
                </PWView>
            )
        case 'joint_account_sign':
            return (
                <PWView style={styles.iconContainer}>
                    <PWIcon
                        name='edit-pen'
                        variant='secondary'
                        size='lg'
                    />
                </PWView>
            )
        default:
            return (
                <PWView style={styles.iconContainer}>
                    <PWIcon
                        name='inbox'
                        variant='secondary'
                        size='lg'
                    />
                </PWView>
            )
    }
}
