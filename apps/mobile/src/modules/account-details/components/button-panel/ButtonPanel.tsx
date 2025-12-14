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

import { useStyles } from './styles'
import PWView from '../../../../components/common/view/PWView'
import { ParamListBase, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import RoundButton from '../../../../components/common/round-button/RoundButton'

import { useState } from 'react'
import SendFundsBottomSheet from '../../../../components/send-funds/bottom-sheet/SendFundsBottomSheet'
import { useLanguage } from '../../../../hooks/language'
import useToast from '../../../../hooks/toast'

const ButtonPanel = () => {
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const themeStyle = useStyles()
    const [sendFundsOpen, setSendFundsOpen] = useState<boolean>(false)
    const { t } = useLanguage()
    const { showToast } = useToast()

    const goToRootPage = (name: string) => {
        navigation.replace('TabBar', { screen: name })
    }

    const notImplemented = () => {
        showToast({
            title: t('common.not_implemented.title'),
            body: t('common.not_implemented.body'),
            type: 'error',
        })
    }

    const closeSendFunds = () => {
        setSendFundsOpen(false)
    }

    const openSendFunds = () => {
        setSendFundsOpen(true)
    }

    return (
        <PWView style={themeStyle.container}>
            <RoundButton
                title={t('account_details.button_panel.swap')}
                icon='swap'
                variant='primary'
                onPress={() => goToRootPage('Swap')}
            />
            <RoundButton
                title={t('account_details.button_panel.stake')}
                icon='dot-stack'
                variant='secondary'
                onPress={() => goToRootPage('Staking')}
            />
            <RoundButton
                title={t('account_details.button_panel.send')}
                icon='outflow'
                variant='secondary'
                onPress={openSendFunds}
            />
            <RoundButton
                title={t('account_details.button_panel.more')}
                icon='ellipsis'
                variant='secondary'
                onPress={notImplemented}
            />
            <SendFundsBottomSheet
                onClose={closeSendFunds}
                isVisible={sendFundsOpen}
            />
        </PWView>
    )
}

export default ButtonPanel
