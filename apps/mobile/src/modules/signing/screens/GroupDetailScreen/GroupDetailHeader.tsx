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

import { PWDivider, PWText } from '@components/core'
import { useTheme } from '@rneui/themed'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

type GroupDetailHeaderProps = {
    transactionCount: number
}

export const GroupDetailHeader = ({
    transactionCount,
}: GroupDetailHeaderProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()

    return (
        <>
            <PWDivider color={theme.colors.layerGray} />

            <PWText style={styles.transactionListHeaderText}>
                {t('transactions.group.transactions_count', {
                    count: transactionCount,
                })}
            </PWText>
        </>
    )
}
