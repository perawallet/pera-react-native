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

import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { TransactionIcon } from '@components/TransactionIcon'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

type GroupPreviewItemProps = {
    transactionCount: number
    /** Hex. */
    groupId?: string
    onPress: () => void
}

export const GroupPreviewItem = ({
    transactionCount,
    groupId,
    onPress,
}: GroupPreviewItemProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWTouchableOpacity
            style={styles.groupPreviewContainer}
            onPress={onPress}
            testID='group_preview_item'
        >
            <TransactionIcon
                name='transactions/group'
                size='sm'
            />
            <PWView style={styles.groupPreviewContent}>
                <PWText variant='bodySemibold'>
                    {t('transactions.group.group_number')}
                </PWText>
                <PWView style={styles.groupPreviewSubtitleContainer}>
                    <PWText
                        variant='caption'
                        style={styles.groupPreviewSubtitle}
                    >
                        {t('transactions.group.transactions_count', {
                            count: transactionCount,
                        })}
                    </PWText>
                    <PWText
                        variant='caption'
                        style={styles.groupPreviewSubtitle}
                    >
                        {t('transactions.group.group_id', {
                            groupId: groupId?.slice(0, 10) ?? '',
                        })}
                    </PWText>
                </PWView>
            </PWView>
            <PWIcon
                name='chevron-right'
                size='sm'
            />
        </PWTouchableOpacity>
    )
}
