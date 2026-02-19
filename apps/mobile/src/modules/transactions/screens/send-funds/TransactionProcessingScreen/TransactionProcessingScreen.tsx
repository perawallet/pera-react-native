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

import { ActivityIndicator } from 'react-native'

import { PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useTheme } from '@rneui/themed'
import { useStyles } from './styles'
import { useTransactionProcessingScreen } from './useTransactionProcessingScreen'

export const TransactionProcessingScreen = () => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()

    useTransactionProcessingScreen()

    return (
        <PWView style={styles.container}>
            <ActivityIndicator
                size='large'
                color={theme.colors.linkPrimary}
            />
            <PWText
                variant='h3'
                style={styles.title}
            >
                {t('send_funds.processing.title')}
            </PWText>
            <PWText style={styles.subtitle}>
                {t('send_funds.processing.subtitle')}
            </PWText>
        </PWView>
    )
}
