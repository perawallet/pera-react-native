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

import { PWButton, PWIcon, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import {
    useNavigation,
    useRoute,
    type RouteProp,
} from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { SendFundsStackParamList } from '../../../routes/send-funds/types'
import { useStyles } from './styles'
import { useCallback } from 'react'

export const InsufficientBalanceScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const navigation =
        useNavigation<StackNavigationProp<SendFundsStackParamList>>()
    const route =
        useRoute<RouteProp<SendFundsStackParamList, 'InsufficientBalance'>>()

    const { requiredBalance } = route.params

    const handleDone = useCallback(() => {
        navigation.goBack()
    }, [navigation])

    return (
        <PWView style={styles.container}>
            <PWView style={styles.content}>
                <PWView style={styles.iconCircle}>
                    <PWIcon
                        name='cross'
                        variant='white'
                    />
                </PWView>
                <PWText
                    variant='h3'
                    style={styles.title}
                >
                    {t('send_funds.insufficient_balance.title')}
                </PWText>
                <PWText style={styles.subtitle}>
                    {t('send_funds.insufficient_balance.message', {
                        amount: requiredBalance,
                    })}
                </PWText>
            </PWView>
            <PWView style={styles.footer}>
                <PWButton
                    title={t('send_funds.insufficient_balance.done')}
                    variant='primary'
                    onPress={handleDone}
                />
            </PWView>
        </PWView>
    )
}
