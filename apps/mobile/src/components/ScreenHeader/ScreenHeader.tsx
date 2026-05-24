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
    PWIcon,
    PWText,
    PWView,
    type IconName,
    type PWIconVariant,
} from '@components/core'
import { useStyles } from './styles'

import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'

/**
 * Large multi-line screen heading rendered below the navigation back arrow.
 * Use on top-level screens where the title doesn't fit a single-line toolbar
 * (e.g. "Select Ledger account"). The h1 wraps freely — no `numberOfLines`
 * — and the optional description appears as a muted h4 below. An optional hero
 * `icon` renders above the title via `PWIcon`.
 */
export type ScreenHeaderProps = {
    icon?: IconName
    iconVariant?: PWIconVariant
    title: string
    description?: ReactNode
    style?: StyleProp<ViewStyle>
    testID?: string
}

export const ScreenHeader = ({
    icon,
    iconVariant,
    title,
    description,
    style,
    testID,
}: ScreenHeaderProps) => {
    const styles = useStyles({ hasIcon: !!icon })

    return (
        <PWView
            style={[styles.container, style]}
            testID={testID}
        >
            {!!icon && (
                <PWIcon
                    name={icon}
                    size='3xl'
                    variant={iconVariant}
                    style={styles.icon}
                    testID='screen-header-icon'
                />
            )}
            <PWText
                variant='h1'
                style={styles.title}
            >
                {title}
            </PWText>
            {description != null && (
                <PWText
                    variant='h4'
                    style={styles.description}
                >
                    {description}
                </PWText>
            )}
        </PWView>
    )
}
