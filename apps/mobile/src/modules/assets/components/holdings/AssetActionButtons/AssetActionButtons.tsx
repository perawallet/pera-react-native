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
import { PWView } from '@components/core'
import { RoundButton } from '@components/RoundButton'
import { ParamListBase, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useCallback } from 'react'
import { useToast } from '@hooks/useToast'
import { PeraAsset } from '@perawallet/wallet-core-assets'
import { useLanguage } from '@hooks/useLanguage'
import { useModalState } from '@hooks/useModalState'
import { SendFundsBottomSheet } from '@modules/transactions/components/SendFunds/PWBottomSheet/SendFundsBottomSheet'
import { ReceiveFundsBottomSheet } from '@modules/transactions/components/ReceiveFunds/PWBottomSheet/ReceiveFundsBottomSheet'
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'

type AssetActionButtonsProps = {
    asset: PeraAsset
}
//TODO hook up missing actions
export const AssetActionButtons = ({ asset }: AssetActionButtonsProps) => {
    const styles = useStyles()
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const { showToast } = useToast()
    const { t } = useLanguage()
    const sendFunds = useModalState()
    const receiveFunds = useModalState()
    const account = useSelectedAccount()

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
                onPress={sendFunds.open}
            />
            <RoundButton
                title={t('asset_details.action_buttons.receive')}
                icon='inflow'
                variant='secondary'
                onPress={receiveFunds.open}
            />
            <SendFundsBottomSheet
                assetId={asset.assetId}
                onClose={sendFunds.close}
                isVisible={sendFunds.isOpen}
            />
            <ReceiveFundsBottomSheet
                account={account ?? undefined}
                onClose={receiveFunds.close}
                isVisible={receiveFunds.isOpen}
            />
        </PWView>
    )
}
