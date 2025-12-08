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
import PWView from '../../../../../components/common/view/PWView'
import RoundButton from '../../../../../components/common/round-button/RoundButton'
import { ParamListBase, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useCallback, useState } from 'react'
import SendFundsBottomSheet from '../../../../../components/send-funds/bottom-sheet/SendFundsBottomSheet'
import useToast from '../../../../../hooks/toast'
import { PeraAsset } from '@perawallet/wallet-core-assets'
import { useLanguage } from '../../../../../hooks/useLanguage'

type AssetActionButtonsProps = {
    asset: PeraAsset
}
//TODO hook up missing actions
const AssetActionButtons = ({ asset }: AssetActionButtonsProps) => {
    const styles = useStyles()
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const { showToast } = useToast()
    const { t } = useLanguage()

    const [sendFundsOpen, setSendFundsOpen] = useState<boolean>(false)

    const goToRootPage = (name: string) => {
        navigation.replace('TabBar', { screen: name })
    }

    const notImplemented = useCallback(() => {
        showToast({
            title: t('common.not_implemented.title'),
            body: t('common.not_implemented.body'),
            type: 'error',
        })
    }, [showToast, t])

    const openSendFunds = () => {
        setSendFundsOpen(true)
    }

    const closeSendFunds = () => {
        setSendFundsOpen(false)
    }

    return (
        <PWView style={styles.container}>
            <RoundButton
                title={t('asset_details.action_buttons.swap')}
                icon='swap'
                variant='primary'
                onPress={() => goToRootPage('Swap')}
            />
            <RoundButton
                title={t('asset_details.action_buttons.buy_sell')}
                icon='dollar'
                variant='secondary'
                onPress={notImplemented}
            />
            <RoundButton
                title={t('asset_details.action_buttons.send')}
                icon='outflow'
                variant='secondary'
                onPress={openSendFunds}
            />
            <RoundButton
                title={t('asset_details.action_buttons.receive')}
                icon='inflow'
                variant='secondary'
                onPress={notImplemented}
            />
            <SendFundsBottomSheet
                assetId={asset.assetId}
                onClose={closeSendFunds}
                isVisible={sendFundsOpen}
            />
        </PWView>
    )
}

export default AssetActionButtons
