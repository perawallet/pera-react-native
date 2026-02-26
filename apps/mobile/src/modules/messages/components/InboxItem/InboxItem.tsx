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

import { PWIcon, PWText, PWView } from '@components/core'
import type {
    ASAInbox,
    InboxItem as InboxItemModel,
} from '@perawallet/wallet-core-notifications'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { useCallback, useMemo } from 'react'
import {
    getAccountDisplayName,
    useAllAccounts,
} from '@perawallet/wallet-core-accounts'
import { AccountIcon } from '@modules/accounts/components/AccountIcon'

export type InboxItemProps = {
    item: InboxItemModel
}

export const InboxItem = ({ item }: InboxItemProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const accounts = useAllAccounts()

    const contentAndIcon = useMemo(() => {
        switch (item.type) {
            case 'asa_inbox': {
                const account = accounts.find(
                    acc => acc.address === item.data.address,
                )
                return {
                    content: (
                        <>
                            <PWText style={styles.titleText}>
                                {t('messages.inbox.asa_requests', {
                                    count: item.data.requestCount,
                                })}
                            </PWText>
                            <PWText
                                variant='caption'
                                style={styles.subtitleText}
                            >
                                {getAccountDisplayName(account ?? null)}
                            </PWText>
                        </>
                    ),
                    icon: account ? 
                        <AccountIcon
                            account={account}
                            size='lg'
                        />
                    : <PWIcon
                            name='inbox'
                            variant='secondary'
                            size='lg'
                        />
                }
            }
            case 'joint_account_import': {
                const account = accounts.find(
                    acc => acc.address === item.data.address,
                )
                return {
                    content: (
                        <>
                            <PWText style={styles.titleText}>
                                {t('messages.inbox.joint_account_import')}
                            </PWText>
                            <PWText
                                variant='caption'
                                style={styles.subtitleText}
                            >
                                {getAccountDisplayName(account ?? null)}
                            </PWText>
                        </>
                    ),
                    icon: <PWView style={styles.iconContainer}>
                        <PWIcon
                            name='transactions/group'
                            variant='secondary'
                            size='lg'
                        />
                    </PWView>
                }
            }
            case 'joint_account_sign':
                return {
                    content: (
                        <>
                            <PWText style={styles.titleText}>
                                {t('messages.inbox.joint_account_sign')}
                            </PWText>
                            <PWText
                                variant='caption'
                                style={styles.subtitleText}
                            >
                                {item.data.status}
                            </PWText>
                        </>
                    ),
                    icon: <PWView style={styles.iconContainer}>
                        <PWIcon
                            name='edit-pen'
                            variant='secondary'
                            size='lg'
                        />
                    </PWView>
                }
        }
    }, [accounts, styles])

    return (
        <PWView style={styles.container}>
            {contentAndIcon.icon}
            <PWView style={styles.messageBox}>{contentAndIcon.content}</PWView>
        </PWView>
    )
}
