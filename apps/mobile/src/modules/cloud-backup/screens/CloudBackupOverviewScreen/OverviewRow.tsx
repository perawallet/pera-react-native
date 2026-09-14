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
import {
    PWIcon,
    PWText,
    PWTouchableOpacity,
    PWView,
    type IconName,
    type PWIconVariant,
} from '@components/core'
import { useOverviewRowStyles } from './styles'

type OverviewRowProps = {
    icon: IconName
    iconVariant?: PWIconVariant
    title: string
    subtitle?: string
    /** Small leading glyph before the subtitle (e.g. a not-backed-up warning). */
    subtitleIcon?: IconName
    subtitleIconVariant?: PWIconVariant
    variant: 'filled' | 'bordered'
    tone?: 'default' | 'negative'
    titleAccessory?: ReactNode
    trailing?: ReactNode
    showChevron?: boolean
    onPress?: () => void
    testID?: string
}

export const OverviewRow = ({
    icon,
    iconVariant = 'primary',
    title,
    subtitle,
    subtitleIcon,
    subtitleIconVariant = 'primary',
    variant,
    tone = 'default',
    titleAccessory,
    trailing,
    showChevron = false,
    onPress,
    testID,
}: OverviewRowProps) => {
    const styles = useOverviewRowStyles({ variant, tone })

    return (
        <PWTouchableOpacity
            style={styles.row}
            onPress={onPress}
            disabled={onPress == null}
            testID={testID}
        >
            <PWIcon
                name={icon}
                variant={iconVariant}
            />
            <PWView style={styles.textContainer}>
                <PWView style={styles.titleRow}>
                    <PWText
                        variant='bodyLarge'
                        weight={500}
                        style={styles.title}
                        numberOfLines={1}
                    >
                        {title}
                    </PWText>
                    {titleAccessory}
                </PWView>
                {subtitle != null && (
                    <PWView style={styles.subtitleRow}>
                        {subtitleIcon != null && (
                            <PWIcon
                                name={subtitleIcon}
                                size='sm'
                                variant={subtitleIconVariant}
                            />
                        )}
                        <PWText
                            variant='body'
                            style={styles.subtitle}
                            numberOfLines={1}
                        >
                            {subtitle}
                        </PWText>
                    </PWView>
                )}
            </PWView>
            {trailing}
            {showChevron && (
                <PWIcon
                    name='chevron-right'
                    variant='secondary'
                />
            )}
        </PWTouchableOpacity>
    )
}
