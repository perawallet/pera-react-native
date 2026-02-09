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

import { PWDivider, PWText, PWView } from '@components/core'
import { TransactionIcon } from '@modules/transactions/components/TransactionIcon'
import { useTheme } from '@rneui/themed'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

type MultiGroupListHeaderProps = {
    groupCount: number
}

export const MultiGroupListHeader = ({
    groupCount,
}: MultiGroupListHeaderProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()

    return (
        <>
            <PWView style={styles.groupHeader}>
                <TransactionIcon
                    type='group'
                    size='lg'
                />
                <PWText variant='h3'>
                    {t('transactions.group.multiple_groups_title')}
                </PWText>
            </PWView>

            <PWDivider color={theme.colors.layerGray} />

            <PWText style={styles.groupListHeaderText}>
                {t('transactions.group.groups_count', {
                    count: groupCount,
                })}
            </PWText>
        </>
    )
}
