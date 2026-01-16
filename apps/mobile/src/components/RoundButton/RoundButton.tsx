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

import { useStyles } from './styles'
import {
    IconName,
    PWIcon,
    PWView,
    PWTouchableOpacity,
    type PWTouchableOpacityProps,
    PWText,
} from '@components/core'

/**
 * Props for the RoundButton component.
 */
export type RoundButtonProps = {
    /** Name of the icon to display in the center */
    icon: IconName
    /** Optional label text to display underneath the button */
    title?: string
    /** Size variant of the button */
    size?: 'sm' | 'lg'
    /** Color variant of the button */
    variant?: 'primary' | 'secondary'
} & PWTouchableOpacityProps

/**
 * A circular action button containing an icon and an optional label.
 *
 * @param props - Component props
 * @example
 * <RoundButton
 *   icon="send"
 *   title="Send"
 *   onPress={handleSend}
 *   variant="primary"
 * />
 */
export const RoundButton = (props: RoundButtonProps) => {
    const style = useStyles(props)
    const {
        icon,
        title,
        size = 'lg',
        variant = 'secondary',
        style: propStyle,
        ...rest
    } = props

    const iconSize = size === 'lg' ? 'md' : 'sm'
    const iconVariant = variant === 'primary' ? 'buttonPrimary' : 'primary'

    return (
        <PWView style={propStyle}>
            <PWTouchableOpacity
                style={style.buttonStyle}
                {...rest}
            >
                <PWIcon
                    name={icon}
                    size={iconSize}
                    variant={iconVariant}
                />
            </PWTouchableOpacity>
            {!!title && <PWText style={style.titleStyle}>{title}</PWText>}
        </PWView>
    )
}
