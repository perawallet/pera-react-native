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

import { Decimal } from 'decimal.js'
import type { AssetWithAccountBalance } from '@perawallet/wallet-core-accounts'
import { PWButton } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { useLanguage } from '@hooks/useLanguage'
import { AccountAssetSelectionList } from '@modules/assets'
import { useAssetSelectionScreen } from './useAssetSelectionScreen'

const hasBalanceFilter = (item: AssetWithAccountBalance) => {
    return item.amount.gt(new Decimal(0))
}

export const AssetSelectionScreen = () => {
    const { t } = useLanguage()
    const {
        chainId,
        networkName,
        canReceive,
        handleAssetSelected,
        handleReceive,
    } = useAssetSelectionScreen()

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
            chainId={chainId}
            emptyView={
                <EmptyView
                    title={t('send_funds.asset_selection.empty_title', {
                        network: networkName,
                    })}
                    body={t('send_funds.asset_selection.empty_body', {
                        network: networkName,
                    })}
                    shouldTruncateBody={false}
                    button={
                        canReceive ? (
                            <PWButton
                                title={t(
                                    'send_funds.asset_selection.empty_receive_action',
                                )}
                                icon='inflow'
                                variant='primary'
                                onPress={handleReceive}
                                testID='send_empty_receive_button'
                            />
                        ) : undefined
                    }
                    testID='send_asset_empty_state'
                />
            }
        />
    )
}
