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
import { PWView } from '@components/core/PWView'
import { useStyles } from './styles'
import { PWIcon, IconName, PWIconVariant } from '@components/core/PWIcon'
import { PWTouchableOpacity } from '@components/core/PWTouchableOpacity'
import {
    ActivityIndicator,
    StyleProp,
    TouchableOpacityProps,
    ViewStyle,
} from 'react-native'
import { getTestProps } from '@utils/test-id-helper'

export type PWButtonProps = TouchableOpacityProps & {
    variant:
        | 'primary'
        | 'secondary'
        | 'helper'
        | 'link'
        | 'linkNeutral'
        | 'linkPositive'
        | 'destructive'
        | 'destructiveLight'
        | 'errorLink'
    title?: string
    icon?: IconName
    iconRight?: IconName
    minWidth?: number
    style?: StyleProp<ViewStyle>
    isDisabled?: boolean
    isLoading?: boolean
    rounded?: boolean
    paddingStyle?: 'none' | 'dense' | 'normal'
}

// Borderless text buttons (toolbar actions, inline links) render their title
// at Body/Medium (weight 500) per the design spec; filled buttons keep the
// heavier h4 (600) title.
const TEXT_BUTTON_VARIANTS = new Set<PWButtonProps['variant']>([
    'link',
    'linkNeutral',
    'linkPositive',
    'errorLink',
])

const ICON_VARIANT_MAP: Record<string, PWIconVariant> = {
    primary: 'buttonPrimary',
    secondary: 'primary',
    helper: 'helper',
    link: 'link',
    linkNeutral: 'primary',
    linkPositive: 'positive',
    destructive: 'white',
    destructiveLight: 'error',
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
    rounded,
    paddingStyle,
    testID,
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
        rounded,
    })

    const iconVariant = ICON_VARIANT_MAP[variant]
    const isTextButton = TEXT_BUTTON_VARIANTS.has(variant)

    return (
        <PWTouchableOpacity
            style={[styles.buttonStyle, style]}
            onPress={onPress}
            disabled={isDisabled || isLoading}
            {...getTestProps(testID)}
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
                <PWView style={styles.titleContainer}>
                    <PWText
                        variant='h4'
                        weight={isTextButton ? 500 : undefined}
                        style={styles.titleStyle}
                        truncate
                    >
                        {title}
                    </PWText>
                </PWView>
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
                <PWView style={styles.loadingContainer}>
                    <ActivityIndicator
                        testID='activity-indicator'
                        size='small'
                        color={styles.loadingStyle.color}
                    />
                </PWView>
            )}
        </PWTouchableOpacity>
    )
}
