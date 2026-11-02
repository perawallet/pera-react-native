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
import { useSettings } from '@perawallet/wallet-core-settings'
import {
    formatCurrency,
    formatPercentage,
} from '@perawallet/wallet-core-shared'
import { PWText } from '@components/core'
import { useStyles } from './styles'

export type ValueChangeLineProps = {
    /** In `currency`, display units. Its sign decides the direction, since `percentage` is 0 when the starting value was. */
    absolute: Decimal
    percentage: Decimal
    currency: string
    testID?: string
}

const SIGN_BY_DIRECTION = { flat: '', gain: '+', loss: '-' } as const

const directionOf = (absolute: Decimal): keyof typeof SIGN_BY_DIRECTION => {
    if (absolute.isZero()) return 'flat'
    return absolute.isPositive() ? 'gain' : 'loss'
}

export const ValueChangeLine = ({
    absolute,
    percentage,
    currency,
    testID,
}: ValueChangeLineProps) => {
    const styles = useStyles()
    const { privacyMode } = useSettings()

    if (privacyMode) return null

    const direction = directionOf(absolute)
    const sign = SIGN_BY_DIRECTION[direction]
    const style = styles[direction]

    return (
        <PWText
            testID={testID}
            variant='bodyLarge'
            style={style}
            truncate
        >
            {sign}
            {formatCurrency(absolute.abs(), 2, currency, undefined, true)} (
            {sign}
            {formatPercentage(percentage.abs())})
        </PWText>
    )
}
