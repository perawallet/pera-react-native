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

import { PWResultView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import {
    useNavigation,
    useRoute,
    type RouteProp,
} from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { SendFundsStackParamList } from '../../../routes/send-funds/types'
import { useCallback } from 'react'

export const InsufficientBalanceScreen = () => {
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
        <PWResultView
            variant='error'
            testID='send_insufficient_balance'
            title={t('send_funds.insufficient_balance.title')}
            body={t('send_funds.insufficient_balance.message', {
                amount: requiredBalance,
            })}
            primaryAction={{
                label: t('send_funds.insufficient_balance.done'),
                onPress: handleDone,
            }}
        />
    )
}
