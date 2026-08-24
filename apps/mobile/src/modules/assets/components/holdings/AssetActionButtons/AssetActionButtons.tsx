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
import { type PeraAsset } from '@perawallet/wallet-core-assets'
import { type Nullable } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { type AssetWithAccountBalance } from '@perawallet/wallet-core-accounts'
import { useAssetActionButtons } from './useAssetActionButtons'

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
    const { t } = useLanguage()
    const {
        isReadOnly,
        isFrozen,
        handleSwap,
        handleSend,
        handleBuy,
        handleReceive,
        handleCopyAddress,
    } = useAssetActionButtons({ asset, assetHolding })

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
                    onPress={handleReceive}
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
                style={[styles.buttonFour, isFrozen && styles.unavailable]}
                testID='asset_detail_swap_button'
            />
            <RoundButton
                title={t('asset_details.action_buttons.buy')}
                icon='dollar'
                variant='secondary'
                onPress={handleBuy}
                style={styles.buttonFour}
                testID='asset_detail_buy_button'
            />
            <RoundButton
                title={t('asset_details.action_buttons.send')}
                icon='outflow'
                variant='secondary'
                onPress={handleSend}
                style={[styles.buttonFour, isFrozen && styles.unavailable]}
                testID='asset_detail_send_button'
            />
            <RoundButton
                title={t('asset_details.action_buttons.receive')}
                icon='inflow'
                variant='secondary'
                onPress={handleReceive}
                style={styles.buttonFour}
                testID='asset_detail_receive_button'
            />
        </PWView>
    )
}
