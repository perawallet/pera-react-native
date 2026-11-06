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
import { PWView } from '@components/core'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { RampToken } from '@perawallet/wallet-core-onramp'
import { OnrampAmountSection } from '../OnrampAmountSection'
import { OnrampMinMaxPill } from '../OnrampMinMaxPill'
import { useStyles } from './styles'

export type OnrampAmountFieldsProps = {
    sourceToken: Nullable<RampToken>
    destinationToken: Nullable<RampToken>
    sourceAmountText: string
    destinationAmount: Nullable<Decimal>
    sourceUsdPrice: Nullable<Decimal>
    destinationUsdPrice: Nullable<Decimal>
    /** A pay and a receive asset are both chosen, so MIN and MAX have limits to fill. */
    hasPair: boolean
    isReceiveLoading: boolean
    onSourceAmountTextChange: (text: string) => void
    onMinPress: () => void
    onMaxPress: () => void
    onOpenSource: () => void
    onOpenDestination: () => void
}

export const OnrampAmountFields = ({
    sourceToken,
    destinationToken,
    sourceAmountText,
    destinationAmount,
    sourceUsdPrice,
    destinationUsdPrice,
    hasPair,
    isReceiveLoading,
    onSourceAmountTextChange,
    onMinPress,
    onMaxPress,
    onOpenSource,
    onOpenDestination,
}: OnrampAmountFieldsProps) => {
    const styles = useStyles()

    return (
        <>
            <OnrampAmountSection
                variant='pay'
                token={sourceToken}
                amountText={sourceAmountText}
                onAmountTextChange={onSourceAmountTextChange}
                usdPrice={sourceUsdPrice}
                onAssetPress={onOpenSource}
            />

            <PWView style={styles.receiveWrapper}>
                {hasPair ? (
                    <PWView style={styles.minMaxPill}>
                        <OnrampMinMaxPill
                            onMin={onMinPress}
                            onMax={onMaxPress}
                        />
                    </PWView>
                ) : null}

                <OnrampAmountSection
                    variant='receive'
                    token={destinationToken}
                    amount={destinationAmount}
                    usdPrice={destinationUsdPrice}
                    onAssetPress={onOpenDestination}
                    isLoading={isReceiveLoading}
                />
            </PWView>
        </>
    )
}
