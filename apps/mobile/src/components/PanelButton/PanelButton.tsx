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
 * Props for the PanelButton component.
 */
export type PanelButtonProps = {
    /** Name of the icon to display on the left side */
    leftIcon?: IconName
    /** Name of the icon to display on the right side */
    rightIcon?: IconName
    /** Text to display in the button */
    title: string
    /** Typography variant/weight for the title */
    titleWeight: 'h3' | 'h4'
    /** Callback triggered when the button is pressed */
    onPress: () => void
} & PWTouchableOpacityProps

/**
 * A wide button component that fills its container, often used for menu items or primary actions.
 *
 * @param props - Component props
 * @example
 * <PanelButton
 *   title="Add Account"
 *   leftIcon="plus"
 *   onPress={handleAddAccount}
 *   titleWeight="h3"
 * />
 */
export const PanelButton = (props: PanelButtonProps) => {
    const themeStyle = useStyles(props)
    const { style, leftIcon, rightIcon, title, titleWeight, onPress, ...rest } =
        props

    return (
        <PWTouchableOpacity onPress={onPress}>
            <PWView
                style={[style, themeStyle.buttonStyle]}
                {...rest}
            >
                {leftIcon && <PWIcon name={leftIcon} />}
                <PWText
                    style={themeStyle.textStyle}
                    variant={titleWeight}
                >
                    {title}
                </PWText>
                {rightIcon && <PWIcon name={rightIcon} />}
            </PWView>
        </PWTouchableOpacity>
    )
}
