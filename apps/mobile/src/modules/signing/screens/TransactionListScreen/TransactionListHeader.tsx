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

type TransactionListHeaderProps = {
    itemCount: number
}

export const TransactionListHeader = ({
    itemCount,
}: TransactionListHeaderProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()

    return (
        <>
            <PWView style={styles.listHeader}>
                <TransactionIcon
                    type='group'
                    size='lg'
                />
                <PWText variant='h3'>
                    {t('signing.transactions.multiple_transactions_title')}
                </PWText>
            </PWView>

            <PWDivider color={theme.colors.layerGray} />

            <PWText style={styles.listSubheaderText}>
                {t('signing.transactions.transactions_count', {
                    count: itemCount,
                })}
            </PWText>
        </>
    )
}
