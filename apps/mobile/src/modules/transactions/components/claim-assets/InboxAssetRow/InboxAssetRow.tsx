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
import type { ReactNode } from 'react'
import type { Decimal } from 'decimal.js'
import type { DisplayableAsset } from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { AssetAmount } from '@components/AssetAmount'
import { PreferredAmount } from '@components/PreferredAmount'
import { AssetItemView } from '@modules/assets'
import { useStyles } from './styles'

export type InboxAssetRowProps = {
    asset: DisplayableAsset
    scope: ChainScope
    /** Display units. */
    amount: Decimal
    /** USD per whole unit; an unpriced asset shows no value. */
    usdPrice: Nullable<Decimal>
    /** Lines under the amount, such as who sent it. */
    footer?: ReactNode
    onPress: () => void
}

/** An incoming asset, laid out like a row of the account's asset list. */
export const InboxAssetRow = ({
    asset,
    scope,
    amount,
    usdPrice,
    footer,
    onPress,
}: InboxAssetRowProps) => {
    const styles = useStyles()
    return (
        <AssetItemView
            asset={asset}
            chainId={scope.chainId}
            subtitle={
                <AssetAmount
                    chainId={scope.chainId}
                    asset={asset}
                    value={amount}
                    density='list'
                    variant='body'
                    style={styles.amount}
                    numberOfLines={1}
                />
            }
            right={
                usdPrice === null ? undefined : (
                    <PreferredAmount
                        sourceAmount={amount}
                        sourceAssetId={asset.assetId}
                        usdPrice={usdPrice}
                        scope={scope}
                        showSymbol
                        style={styles.value}
                        numberOfLines={1}
                    />
                )
            }
            shouldCapRightSlot
            shouldTopAlignRight
            footer={footer}
            onPress={onPress}
            style={styles.row}
        />
    )
}
