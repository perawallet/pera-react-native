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

import { nativeAssetFor, toWholeUnits } from '@perawallet/wallet-core-assets'
import { PWView } from '@components/core'
import { AssetAmount } from '@components/AssetAmount'
import { KeyValueRow } from '@components/KeyValueRow'
import { useLanguage } from '@hooks/useLanguage'
import { FEE_ROW_TEST_ID, type FeeRowProps } from './types'
import { useStyles } from './styles'

export const FlatFeeRow = ({
    scope,
    amount,
    isLoading,
    accessory,
}: Pick<FeeRowProps, 'scope' | 'amount' | 'isLoading' | 'accessory'>) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const asset = nativeAssetFor(scope.chainId)

    return (
        <KeyValueRow
            testID={FEE_ROW_TEST_ID}
            title={t('send_funds.confirmation.fee')}
        >
            <PWView style={styles.feeValueContainer}>
                <AssetAmount
                    chainId={scope.chainId}
                    asset={asset}
                    showSymbol
                    ignorePrivacyMode
                    value={amount ? toWholeUnits(amount, asset) : null}
                    isLoading={isLoading}
                />
                {accessory}
            </PWView>
        </KeyValueRow>
    )
}
