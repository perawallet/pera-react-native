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

import { PWText } from '@components/core/PWText'
import { useStyles } from './styles'
import { PWIcon, IconName, PWIconVariant } from '@components/core/PWIcon'
import { PWTouchableOpacity } from '@components/core/PWTouchableOpacity'
import { ActivityIndicator, StyleProp, ViewStyle } from 'react-native'

export type PWButtonProps = {
    variant:
    | 'primary'
    | 'secondary'
    | 'helper'
    | 'link'
    | 'destructive'
    | 'errorLink'
    title?: string
    icon?: IconName
    iconRight?: IconName
    onPress?: () => void
    minWidth?: number
    style?: StyleProp<ViewStyle>
    isDisabled?: boolean
    isLoading?: boolean
    paddingStyle?: 'none' | 'dense' | 'normal'
}

const ICON_VARIANT_MAP: Record<string, PWIconVariant> = {
    primary: 'buttonPrimary',
    secondary: 'primary',
    helper: 'helper',
    link: 'link',
    destructive: 'white',
    errorLink: 'error',
}

export const PWButton = ({
    variant,
    title,
    icon,
    iconRight,
    onPress,
    style,
    isDisabled,
    isLoading,
    paddingStyle,
    ...props
}: PWButtonProps) => {
    const styles = useStyles({
        variant,
        title,
        icon,
        onPress,
        style,
        isDisabled,
        isLoading,
        paddingStyle,
    })

    const iconVariant = ICON_VARIANT_MAP[variant]

    return (
        <PWTouchableOpacity
            style={[styles.buttonStyle, style]}
            onPress={onPress}
            disabled={isDisabled}
            {...props}
        >
            {!!icon && !isLoading && (
                <PWIcon
                    name={icon}
                    variant={iconVariant}
                    size={
                        paddingStyle === 'dense' || paddingStyle === 'none'
                            ? 'sm'
                            : 'md'
                    }
                />
            )}
            {!!title && !isLoading && (
                <PWText style={styles.titleStyle}>{title}</PWText>
            )}
            {!!iconRight && !isLoading && (
                <PWIcon
                    name={iconRight}
                    variant={iconVariant}
                    size={
                        paddingStyle === 'dense' || paddingStyle === 'none'
                            ? 'sm'
                            : 'md'
                    }
                />
            )}

            {isLoading && (
                <ActivityIndicator
                    size='small'
                    color={styles.loadingStyle.color}
                />
            )}
        </PWTouchableOpacity>
    )
}
