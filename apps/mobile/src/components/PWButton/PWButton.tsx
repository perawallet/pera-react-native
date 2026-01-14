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

import { Text } from '@rneui/themed'
import { useStyles } from './styles'
import PWIcon, { IconName, PWIconVariant } from '../PWIcon/PWIcon'
import PWTouchableOpacity from '../PWTouchableOpacity/PWTouchableOpacity'
import { ActivityIndicator, StyleProp, ViewStyle } from 'react-native'

export type PWButtonProps = {
    variant: 'primary' | 'secondary' | 'helper' | 'link' | 'destructive'
    title?: string
    icon?: IconName
    onPress?: () => void
    minWidth?: number
    style?: StyleProp<ViewStyle>
    disabled?: boolean
    loading?: boolean
    paddingStyle?: 'none' | 'dense' | 'normal'
}

const ICON_VARIANT_MAP: Record<string, PWIconVariant> = {
    primary: 'buttonPrimary',
    secondary: 'primary',
    helper: 'helper',
    link: 'link',
    destructive: 'white',
}

const PWButton = (props: PWButtonProps) => {
    const styles = useStyles(props)

    const iconVariant = ICON_VARIANT_MAP[props.variant]

    return (
        <PWTouchableOpacity
            style={[styles.buttonStyle, props.style]}
            onPress={props.onPress}
            disabled={props.disabled}
        >
            {!!props.icon && !props.loading && (
                <PWIcon
                    name={props.icon}
                    variant={iconVariant}
                    size={
                        props.paddingStyle === 'dense' ||
                        props.paddingStyle === 'none'
                            ? 'sm'
                            : 'md'
                    }
                />
            )}
            {!!props.title && !props.loading && (
                <Text style={styles.titleStyle}>{props.title}</Text>
            )}

            {props.loading && (
                <ActivityIndicator
                    size='small'
                    color={styles.loadingStyle.color}
                />
            )}
        </PWTouchableOpacity>
    )
}

export default PWButton
