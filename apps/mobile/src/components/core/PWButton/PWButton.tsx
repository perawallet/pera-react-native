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

/**
 * Props for the PWButton component.
 */
export type PWButtonProps = {
    /** Button style variant */
    variant: 'primary' | 'secondary' | 'helper' | 'link' | 'destructive'
    /** Button text title */
    title?: string
    /** Optional icon to display alongside the title */
    icon?: IconName
    /** Callback when button is pressed */
    onPress?: () => void
    /** Minimum width for the button */
    minWidth?: number
    /** Optional style overrides for the button container */
    style?: StyleProp<ViewStyle>
    /** Whether the button is disabled */
    isDisabled?: boolean
    /** Whether the button is in a loading state */
    isLoading?: boolean
    /** Padding style variant for the button */
    paddingStyle?: 'none' | 'dense' | 'normal'
}

const ICON_VARIANT_MAP: Record<string, PWIconVariant> = {
    primary: 'buttonPrimary',
    secondary: 'primary',
    helper: 'helper',
    link: 'link',
    destructive: 'white',
}

/**
 * A themed button component with loading and disabled states.
 * Wraps {@link PWTouchableOpacity} and supports multiple variants.
 *
 * @example
 * <PWButton
 *   variant="primary"
 *   title="Submit"
 *   onPress={handleSubmit}
 *   isLoading={isSubmitting}
 * />
 */
export const PWButton = ({
    variant,
    title,
    icon,
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

            {isLoading && (
                <ActivityIndicator
                    size='small'
                    color={styles.loadingStyle.color}
                />
            )}
        </PWTouchableOpacity>
    )
}
