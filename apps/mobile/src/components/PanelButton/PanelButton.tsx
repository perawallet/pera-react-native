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

export type PanelButtonProps = {
    leftIcon?: IconName
    rightIcon?: IconName
    title: string
    description?: string
    titleWeight: 'h3' | 'h4'
    variant?: 'default' | 'error'
    onPress: () => void
} & PWTouchableOpacityProps

export const PanelButton = (props: PanelButtonProps) => {
    const themeStyle = useStyles(props)
    const {
        style,
        leftIcon,
        rightIcon,
        title,
        titleWeight,
        variant,
        onPress,
        description,
        ...rest
    } = props

    return (
        <PWTouchableOpacity onPress={onPress}>
            <PWView
                style={[style, themeStyle.buttonStyle]}
                {...rest}
            >
                <PWView style={themeStyle.textContainerStyle}>
                    <PWView style={themeStyle.titleStyle}>
                        {!!leftIcon && (
                            <PWIcon
                                name={leftIcon}
                                variant={
                                    variant === 'error' ? 'error' : 'primary'
                                }
                            />
                        )}
                        <PWText
                            style={themeStyle.textStyle}
                            variant={titleWeight}
                        >
                            {title}
                        </PWText>
                    </PWView>
                    {!!description && (
                        <PWText style={themeStyle.descriptionStyle}>
                            {description}
                        </PWText>
                    )}
                </PWView>
                {rightIcon && <PWIcon name={rightIcon} />}
            </PWView>
        </PWTouchableOpacity>
    )
}
