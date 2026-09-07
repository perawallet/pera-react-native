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

import { useCallback } from 'react'
import { Decimal } from 'decimal.js'
import type { AssetWithAccountBalance } from '@perawallet/wallet-core-accounts'
import { isCollectible, isPureNft } from '@perawallet/wallet-core-assets'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { SendFundsStackParamList } from '../../../routes/send-funds/types'
import { useSendFunds } from '@modules/transactions/hooks'
import { useLanguage } from '@hooks/useLanguage'
import { AccountAssetSelectionList } from '@modules/assets/components/AccountAssetSelectionList'

const hasBalanceFilter = (item: AssetWithAccountBalance) => {
    return item.amount.gt(Decimal(0))
}

export const AssetSelectionScreen = () => {
    const { t } = useLanguage()
    const { setSelectedAssetId, setAmount } = useSendFunds()
    const navigation =
        useNavigation<StackNavigationProp<SendFundsStackParamList>>()

    const handleAssetSelected = useCallback(
        (item: AssetWithAccountBalance) => {
            setSelectedAssetId(item.assetId)
            // Pure collectibles have a fixed quantity of 1, so prefill
            // the amount and skip straight to picking a destination.
            if (
                item.asset &&
                isCollectible(item.asset) &&
                isPureNft(item.asset)
            ) {
                setAmount(new Decimal(1))
                navigation.navigate('SelectDestination')
                return
            }
            navigation.navigate('InputAmount')
        },
        [navigation, setSelectedAssetId, setAmount],
    )

    return (
        <AccountAssetSelectionList
            onAssetSelected={handleAssetSelected}
            inBottomSheet
            hasPadding={false}
            searchPlaceholder={t(
                'send_funds.asset_selection.search_placeholder',
            )}
            emptyResultTitle={t('send_funds.asset_selection.no_results_title')}
            emptyResultBody={t('send_funds.asset_selection.no_results_body')}
            filterAsset={hasBalanceFilter}
        />
    )
}
