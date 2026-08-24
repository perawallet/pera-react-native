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

import { useStyles } from './styles'
import { PWView } from '@components/core'
import { RoundButton } from '@components/RoundButton'
import { type ParamListBase, useNavigation } from '@react-navigation/native'
import { type NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useCallback } from 'react'
import { type PeraAsset } from '@perawallet/wallet-core-assets'
import {
    isAlgoAssetId,
    ALGO_ASSET_ID,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { SendFundsContent } from '@modules/transactions/components/send-funds/SendFundsContent'
import { ReceiveFundsContent } from '@modules/transactions/components/receive-funds/ReceiveFundsContent'
import { useBottomSheet } from '@modules/bottom-sheet'
import {
    useSelectedAccount,
    useCanSignWith,
    type AssetWithAccountBalance,
} from '@perawallet/wallet-core-accounts'
import { useSendFunds } from '@modules/transactions/hooks'
import { useClipboard } from '@hooks/useClipboard'
import { useToast } from '@hooks/useToast'
import { trackEvent, AssetDetailsEvent } from '@analytics'

export type AssetActionButtonsProps = {
    asset: PeraAsset
    assetHolding?: Nullable<AssetWithAccountBalance>
    isCollectible?: boolean
}
//TODO hook up missing actions
export const AssetActionButtons = ({
    asset,
    assetHolding,
    isCollectible,
}: AssetActionButtonsProps) => {
    const styles = useStyles()
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const { t } = useLanguage()
    const account = useSelectedAccount()
    const { request: requestBottomSheet } = useBottomSheet()
    const isReadOnly = !useCanSignWith(account)
    const { setSelectedAssetId, setCanSelectAsset } = useSendFunds()
    const { copyToClipboard } = useClipboard()
    const { showToast } = useToast()
    const isFrozen = assetHolding?.isFrozen ?? false

    const openReceiveFunds = useCallback(() => {
        trackEvent(AssetDetailsEvent.Receive)
        void requestBottomSheet({
            contents: <ReceiveFundsContent account={account ?? undefined} />,
            options: {
                size: 'modal',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [requestBottomSheet, account])

    const goToRootPage = (name: string) => {
        navigation.replace('TabBar', { screen: name })
    }

    const handleSwap = useCallback(() => {
        const isAlgo = isAlgoAssetId(asset.assetId)
        if (isAlgo) {
            trackEvent(AssetDetailsEvent.SwapAlgo)
        }
        navigation.replace('TabBar', {
            screen: 'Swap',
            params: isAlgo
                ? undefined
                : { assetInId: ALGO_ASSET_ID, assetOutId: asset.assetId },
        })
    }, [asset.assetId, navigation])

    const handleSend = useCallback(() => {
        trackEvent(AssetDetailsEvent.Send)
        if (assetHolding) {
            setSelectedAssetId(assetHolding.assetId)
            setCanSelectAsset(false)
        }

        void requestBottomSheet({
            contents: <SendFundsContent assetId={asset.assetId} />,
            options: {
                size: 'modal',
                enablePanDownToClose: false,
                enableCloseOnBackdropPress: false,
                autoCreateContainer: false,
            },
        })
    }, [
        assetHolding,
        setSelectedAssetId,
        setCanSelectAsset,
        requestBottomSheet,
        asset.assetId,
    ])

    const handleCopyAddress = useCallback(() => {
        if (account) {
            void copyToClipboard(account.address)
            showToast({
                title: t('account_options.copy_address'),
                body: '',
                type: 'success',
            })
        }
    }, [account, copyToClipboard, showToast, t])

    if (isCollectible) return null

    if (isReadOnly) {
        return (
            <PWView style={styles.container}>
                <RoundButton
                    title={t('account_details.watch_button_panel.copy_address')}
                    icon='copy'
                    variant='primary'
                    onPress={handleCopyAddress}
                    style={styles.buttonTwo}
                    testID='asset_detail_copy_address_button'
                />
                <RoundButton
                    title={t('asset_details.action_buttons.receive')}
                    icon='inflow'
                    variant='secondary'
                    onPress={openReceiveFunds}
                    style={styles.buttonTwo}
                    testID='asset_detail_receive_button'
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
                disabled={isFrozen}
                badgeIcon={isFrozen ? 'snowflake' : undefined}
                style={styles.buttonFour}
                testID='asset_detail_swap_button'
            />
            <RoundButton
                title={t('asset_details.action_buttons.buy')}
                icon='dollar'
                variant='secondary'
                onPress={() => goToRootPage('Fund')}
                style={styles.buttonFour}
                testID='asset_detail_buy_button'
            />
            <RoundButton
                title={t('asset_details.action_buttons.send')}
                icon='outflow'
                variant='secondary'
                onPress={handleSend}
                disabled={isFrozen}
                badgeIcon={isFrozen ? 'snowflake' : undefined}
                style={styles.buttonFour}
                testID='asset_detail_send_button'
            />
            <RoundButton
                title={t('asset_details.action_buttons.receive')}
                icon='inflow'
                variant='secondary'
                onPress={openReceiveFunds}
                style={styles.buttonFour}
                testID='asset_detail_receive_button'
            />
        </PWView>
    )
}
