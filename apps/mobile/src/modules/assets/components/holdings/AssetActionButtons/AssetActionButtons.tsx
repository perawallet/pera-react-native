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
import { PeraAsset } from '@perawallet/wallet-core-assets'
import { useLanguage } from '@hooks/useLanguage'
import { useModalState } from '@hooks/useModalState'
import { SendFundsBottomSheet } from '@modules/transactions/components/send-funds/SendFundsBottomSheet/SendFundsBottomSheet'
import { ReceiveFundsBottomSheet } from '@modules/transactions/components/receive-funds/ReceiveFundsBottomSheet'
import {
    useSelectedAccount,
    useAllAccounts,
    isSigningAccount,
    AssetWithAccountBalance,
} from '@perawallet/wallet-core-accounts'
import { useSendFunds } from '@modules/transactions/hooks'
import { useClipboard } from '@hooks/useClipboard'
import { useToast } from '@hooks/useToast'
import type { Nullable } from '@perawallet/wallet-core-shared'

export type AssetActionButtonsProps = {
    asset: PeraAsset
    assetHolding?: Nullable<AssetWithAccountBalance>
}
//TODO hook up missing actions
export const AssetActionButtons = ({
    asset,
    assetHolding,
}: AssetActionButtonsProps) => {
    const styles = useStyles()
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const { t } = useLanguage()
    const sendFunds = useModalState()
    const receiveFunds = useModalState()
    const account = useSelectedAccount()
    const allAccounts = useAllAccounts()
    const { setSelectedAssetId, setCanSelectAsset } = useSendFunds()
    const { copyToClipboard } = useClipboard()
    const { showToast } = useToast()
    const isWatch = account ? !isSigningAccount(account, allAccounts) : true

    const goToRootPage = (name: string) => {
        navigation.replace('TabBar', { screen: name })
    }

    const handleSwap = useCallback(() => {
        const isAlgo = asset.assetId === '0'
        navigation.replace('TabBar', {
            screen: 'Swap',
            params: isAlgo
                ? undefined
                : { assetInId: '0', assetOutId: asset.assetId },
        })
    }, [asset.assetId, navigation])

    const handleSend = useCallback(() => {
        if (assetHolding) {
            setSelectedAssetId(assetHolding.assetId)
            setCanSelectAsset(false)
        }

        sendFunds.open()
    }, [assetHolding, setSelectedAssetId, setCanSelectAsset, sendFunds])

    const handleCopyAddress = useCallback(() => {
        if (account) {
            copyToClipboard(account.address)
            showToast({
                title: t('account_options.copy_address'),
                body: '',
                type: 'success',
            })
        }
    }, [account, copyToClipboard, showToast, t])

    if (isWatch) {
        return (
            <PWView style={styles.container}>
                <RoundButton
                    title={t('account_details.watch_button_panel.copy_address')}
                    icon='copy'
                    variant='primary'
                    onPress={handleCopyAddress}
                />
                <RoundButton
                    title={t('asset_details.action_buttons.receive')}
                    icon='inflow'
                    variant='secondary'
                    onPress={receiveFunds.open}
                />
                <ReceiveFundsBottomSheet
                    account={account ?? undefined}
                    onClose={receiveFunds.close}
                    isVisible={receiveFunds.isOpen}
                />
            </PWView>
        )
    }

    return (
        <PWView style={styles.container}>
            <RoundButton
                title={t('asset_details.action_buttons.swap')}
                icon='swap'
                variant='primary'
                onPress={handleSwap}
            />
            <RoundButton
                title={t('asset_details.action_buttons.buy')}
                icon='dollar'
                variant='secondary'
                onPress={() => goToRootPage('Fund')}
            />
            <RoundButton
                title={t('asset_details.action_buttons.send')}
                icon='outflow'
                variant='secondary'
                onPress={handleSend}
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
