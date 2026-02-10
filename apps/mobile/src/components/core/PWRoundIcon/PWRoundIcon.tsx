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
    PWIcon,
    PWIconSize,
    PWIconVariant,
} from '@components/core/PWIcon'
import { PWView, PWViewProps } from '@components/core/PWView'
import { ViewStyle } from 'react-native'
import { useStyles } from './styles'

export type PWRoundIconProps = {
    icon: IconName
    size?: PWIconSize
    variant?: PWIconVariant
    style?: ViewStyle
} & PWViewProps

const ICON_SIZE_MAP: Record<PWIconSize, PWIconSize> = {
    xs: 'xs',
    sm: 'sm',
    md: 'sm',
    lg: 'md',
    xl: 'lg',
    xxl: 'xl',
}

const ICON_VARIANT_MAP: Record<PWIconVariant, PWIconVariant> = {
    primary: 'white',
    secondary: 'primary',
    buttonPrimary: 'buttonPrimary',
    helper: 'helper',
    white: 'white',
    link: 'link',
    error: 'error',
    positive: 'positive',
}

export const PWRoundIcon = (props: PWRoundIconProps) => {
    const {
        icon,
        size = 'md',
        variant = 'secondary',
        style: propStyle,
        ...rest
    } = props
    const styles = useStyles(props)

    return (
        <PWView
            style={[styles.container, propStyle]}
            {...rest}
        >
            <PWIcon
                name={icon}
                size={ICON_SIZE_MAP[size]}
                variant={ICON_VARIANT_MAP[variant]}
            />
        </PWView>
    )
}
