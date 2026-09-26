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
import type { RampQuoteLimits, RampToken } from '@perawallet/wallet-core-onramp'
import { OnrampAmountSection } from '../OnrampAmountSection'
import { OnrampMinMaxPill } from '../OnrampMinMaxPill'
import { useStyles } from './styles'

export type OnrampAmountFieldsProps = {
    sourceToken: Nullable<RampToken>
    destinationToken: Nullable<RampToken>
    sourceAmount: string
    destinationAmount: Nullable<Decimal>
    limits: Nullable<RampQuoteLimits>
    isReceiveLoading: boolean
    onSourceAmountChange: (amount: string) => void
    onSetSourceAmount: (amount: string) => void
    onOpenSource: () => void
    onOpenDestination: () => void
}

export const OnrampAmountFields = ({
    sourceToken,
    destinationToken,
    sourceAmount,
    destinationAmount,
    limits,
    isReceiveLoading,
    onSourceAmountChange,
    onSetSourceAmount,
    onOpenSource,
    onOpenDestination,
}: OnrampAmountFieldsProps) => {
    const styles = useStyles()

    // Destructure so narrowing survives into the JSX closures below.
    const min = limits?.min ?? null
    const max = limits?.max ?? null

    return (
        <>
            <OnrampAmountSection
                variant='pay'
                token={sourceToken}
                amount={sourceAmount}
                onAmountChange={onSourceAmountChange}
                onAssetPress={onOpenSource}
            />

            <PWView style={styles.receiveWrapper}>
                {min || max ? (
                    <PWView style={styles.minMaxPill}>
                        <OnrampMinMaxPill
                            onMin={
                                min
                                    ? () => onSetSourceAmount(min.toString())
                                    : undefined
                            }
                            onMax={
                                max
                                    ? () => onSetSourceAmount(max.toString())
                                    : undefined
                            }
                        />
                    </PWView>
                ) : null}

                <OnrampAmountSection
                    variant='receive'
                    token={destinationToken}
                    amount={destinationAmount}
                    onAssetPress={onOpenDestination}
                    isLoading={isReceiveLoading}
                />
            </PWView>
        </>
    )
}
