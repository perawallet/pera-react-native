/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import {
    IconName,
    PWIconVariant,
    PWRoundIcon,
    PWText,
    PWTouchableOpacity,
    PWView,
    PWViewProps,
} from '@components/core'
import { AlgoBalanceColumn } from '@components/AlgoBalanceColumn'
import { useStyles } from './styles'

import type { Decimal } from 'decimal.js'
import type { TypographyVariant } from '@theme/typography'

export type BalanceListItemProps = {
    icon: IconName
    iconVariant?: PWIconVariant
    title: string
    titleVariant?: TypographyVariant
    subtitle?: string
    algoValue?: Decimal
    algoVariant?: TypographyVariant
    fiatVariant?: TypographyVariant
    isHighlighted?: boolean
    onPress?: () => void
    testID?: string
} & PWViewProps

export const BalanceListItem = ({
    icon,
    iconVariant,
    title,
    titleVariant = 'h4',
    subtitle,
    algoValue,
    algoVariant,
    fiatVariant,
    isHighlighted,
    onPress,
    testID,
    ...rest
}: BalanceListItemProps) => {
    const styles = useStyles({ isHighlighted })

    const content = (
        <>
            <PWRoundIcon
                icon={icon}
                size='lg'
                variant={iconVariant}
            />
            <PWView style={styles.textContainer}>
                <PWText
                    variant={titleVariant}
                    truncate
                >
                    {title}
                </PWText>
                {subtitle ? (
                    <PWText
                        variant='caption'
                        style={styles.subtitle}
                    >
                        {subtitle}
                    </PWText>
                ) : null}
            </PWView>
            <AlgoBalanceColumn
                algoValue={algoValue}
                algoVariant={algoVariant}
                fiatVariant={fiatVariant}
            />
        </>
    )

    if (onPress) {
        return (
            <PWTouchableOpacity
                style={[styles.container, rest.style]}
                onPress={onPress}
                testID={testID}
            >
                {content}
            </PWTouchableOpacity>
        )
    }

    return (
        <PWView
            {...rest}
            style={[styles.container, rest.style]}
            testID={testID}
        >
            {content}
        </PWView>
    )
}
