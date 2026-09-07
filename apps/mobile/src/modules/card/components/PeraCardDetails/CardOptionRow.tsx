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
import { ActivityIndicator } from 'react-native'
import {
    PWIcon,
    PWText,
    PWTouchableOpacity,
    type IconName,
} from '@components/core'
import { useStyles } from './styles'

type CardOptionRowProps = {
    /** Themeable monochrome PWIcon; ignored when `iconElement` is provided. */
    icon?: IconName
    /** Pre-built leading element (e.g. a fixed multi-color brand SVG). */
    iconElement?: ReactNode
    label: string
    onPress: () => void
    variant?: 'default' | 'destructive'
    /** Shows a spinner in place of the icon and disables the row while pending. */
    isLoading?: boolean
    /** Disables the row without a spinner (e.g. offline-unsafe actions). */
    isDisabled?: boolean
    testID?: string
}

export const CardOptionRow = ({
    icon,
    iconElement,
    label,
    onPress,
    variant = 'default',
    isLoading = false,
    isDisabled = false,
    testID,
}: CardOptionRowProps) => {
    const styles = useStyles()
    const isDestructive = variant === 'destructive'

    return (
        <PWTouchableOpacity
            style={[styles.optionRow, isDisabled && styles.disabled]}
            onPress={onPress}
            disabled={isLoading || isDisabled}
            testID={testID}
        >
            {isLoading ? (
                <ActivityIndicator />
            ) : (
                (iconElement ??
                (icon != null ? (
                    <PWIcon
                        name={icon}
                        size='md'
                        variant={isDestructive ? 'error' : 'primary'}
                    />
                ) : null))
            )}
            <PWText
                variant='body'
                weight={500}
                style={
                    isDestructive ? styles.optionLabelDestructive : undefined
                }
            >
                {label}
            </PWText>
        </PWTouchableOpacity>
    )
}
