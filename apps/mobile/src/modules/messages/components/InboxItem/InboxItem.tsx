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

import { PWText, PWTouchableOpacity, PWView } from '@components/core'
import type { InboxItem as InboxItemModel } from '@perawallet/wallet-core-messages'
import { useLanguage } from '@hooks/useLanguage'
import {
    getAccountDisplayName,
    useAllAccounts,
} from '@perawallet/wallet-core-accounts'
import { useStyles } from './styles'
import { InboxItemIcon } from './InboxItemIcon'
import { useMemo } from 'react'

export type InboxItemProps = {
    item: InboxItemModel
    onPress?: () => void
}

export const InboxItem = ({ item, onPress }: InboxItemProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const accounts = useAllAccounts()

    const content = useMemo(() => {
        switch (item.type) {
            case 'asa_inbox': {
                const account = accounts.find(
                    acc => acc.address === item.data.address,
                )
                return (
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
                )
            }
            case 'joint_account_import': {
                const account = accounts.find(
                    acc => acc.address === item.data.address,
                )
                return (
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
                )
            }
            case 'joint_account_sign':
                return (
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
                )
        }
    }, [accounts, styles])

    return (
        <PWTouchableOpacity
            style={styles.container}
            onPress={onPress}
            disabled={!onPress}
        >
            <InboxItemIcon item={item} />
            <PWView style={styles.messageBox}>{content}</PWView>
        </PWTouchableOpacity>
    )
}
