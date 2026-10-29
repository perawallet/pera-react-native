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

import type { Decimal } from 'decimal.js'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { nativeAssetFor, toWholeUnits } from '@perawallet/wallet-core-assets'
import { PWView } from '@components/core'
import { AssetAmount } from '@components/AssetAmount'
import { PreferredAmount } from '@components/PreferredAmount'
import { useStyles } from './styles'

export type FeeAmountProps = {
    scope: ChainScope
    /** Base units of the chain's native asset. */
    amount: Decimal
    testID?: string
}

// Wraps rather than truncates: a fee cut to "0.00000…" is the one value the user can't afford to lose.
export const FeeAmount = ({ scope, amount, testID }: FeeAmountProps) => {
    const styles = useStyles()
    const asset = nativeAssetFor(scope.chainId)
    const wholeAmount = toWholeUnits(amount, asset)

    return (
        <PWView style={styles.feeAmount}>
            <AssetAmount
                asset={asset}
                value={wholeAmount}
                density='significant'
                symbolPosition='end'
                alignRight
                ignorePrivacyMode
                truncate={false}
                testID={testID}
            />
            <PreferredAmount
                sourceAmount={wholeAmount}
                sourceAssetId={asset.assetId}
                scope={scope}
                density='compact'
                alignRight
                ignorePrivacyMode
                truncate={false}
                style={styles.secondaryText}
                testID={testID ? `${testID}_fiat` : undefined}
            />
        </PWView>
    )
}
