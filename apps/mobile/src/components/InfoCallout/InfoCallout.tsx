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

import type { StyleProp, ViewStyle } from 'react-native'
import type { TypographyVariant } from '@theme/typography'
import { PWIcon, PWText, PWView } from '@components/core'
import type { IconName, PWIconSize, PWIconVariant } from '@components/core'
import { useStyles } from './styles'

/**
 * Inline informational callout: a leading icon next to a title + body in a
 * tinted rounded box. The box owns no outer spacing — pass `style` to position
 * it (margins) or override padding for a denser layout.
 */
export type InfoCalloutProps = {
    title: string
    body: string
    /** Leading icon. Defaults to the generic info glyph. */
    icon?: IconName
    iconSize?: PWIconSize
    iconVariant?: PWIconVariant
    titleVariant?: TypographyVariant
    style?: StyleProp<ViewStyle>
    testID?: string
}

export const InfoCallout = ({
    title,
    body,
    icon = 'info',
    iconSize,
    iconVariant,
    titleVariant = 'body',
    style,
    testID,
}: InfoCalloutProps) => {
    const styles = useStyles()

    return (
        <PWView
            style={[styles.container, style]}
            testID={testID}
        >
            <PWIcon
                name={icon}
                size={iconSize}
                variant={iconVariant}
            />
            <PWView style={styles.textColumn}>
                <PWText variant={titleVariant}>{title}</PWText>
                <PWText
                    variant='caption'
                    style={styles.body}
                >
                    {body}
                </PWText>
            </PWView>
        </PWView>
    )
}
