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

import { useStyles } from './styles'
import {
    type IconName,
    PWBadge,
    type PWBadgeProps,
    PWIcon,
    PWView,
    PWTouchableOpacity,
    type PWTouchableOpacityProps,
    PWText,
} from '@components/core'
import { getTestProps } from '@utils/test-id-helper'

export type PanelButtonProps = {
    leftIcon?: IconName
    rightIcon?: IconName
    title: string
    description?: string
    titleWeight: 'h3' | 'h4'
    variant?: 'default' | 'error'
    paddingStyle?: 'normal' | 'dense'
    /** Optional badge shown inline next to the title (e.g. a "NEW" pill). */
    badge?: { label: string; variant?: PWBadgeProps['variant'] }
    /**
     * Optional link rendered below the description with its own press
     * handler, independent of the row's onPress (e.g. "Learn more").
     */
    learnMore?: { label: string; onPress: () => void }
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
        badge,
        learnMore,
        onPress,
        description,
        testID,
        ...rest
    } = props

    return (
        <PWTouchableOpacity
            onPress={onPress}
            {...getTestProps(testID)}
            {...rest}
        >
            <PWView
                style={[style, themeStyle.buttonStyle]}
                {...getTestProps(testID, 'view')}
            >
                {!!leftIcon && (
                    <PWIcon
                        name={leftIcon}
                        variant={variant === 'error' ? 'error' : 'primary'}
                    />
                )}
                <PWView style={themeStyle.textContainerStyle}>
                    <PWView style={themeStyle.titleContainerStyle}>
                        <PWText
                            style={themeStyle.textStyle}
                            variant={titleWeight}
                            // A badged row is a highlighted one; keeping its
                            // title to a single line holds the row height
                            // steady across devices and font scales.
                            truncate={!!badge}
                            {...getTestProps(testID, 'text')}
                        >
                            {title}
                        </PWText>
                        {rightIcon && <PWIcon name={rightIcon} />}
                    </PWView>
                    {!!description && (
                        <PWText style={themeStyle.descriptionStyle}>
                            {description}
                        </PWText>
                    )}
                    {(!!learnMore || !!badge) && (
                        <PWView style={themeStyle.footerRowStyle}>
                            {!!learnMore && (
                                <PWTouchableOpacity
                                    style={themeStyle.learnMoreStyle}
                                    onPress={event => {
                                        // Keep the tap on the link only — don't
                                        // also trigger the row's onPress.
                                        event?.stopPropagation?.()
                                        learnMore.onPress()
                                    }}
                                    {...getTestProps(testID, 'learn_more')}
                                >
                                    {/*
                                      linkPositive keeps the teal link tone in
                                      both themes (link's dark tone is the brand
                                      yellow), per the Quantum "Learn more"
                                      design.
                                    */}
                                    <PWText variant='linkPositive'>
                                        {learnMore.label}
                                    </PWText>
                                </PWTouchableOpacity>
                            )}
                            {!!badge && (
                                <PWBadge
                                    variant={badge.variant}
                                    value={badge.label}
                                    containerStyle={
                                        themeStyle.badgeContainerStyle
                                    }
                                />
                            )}
                        </PWView>
                    )}
                </PWView>
            </PWView>
        </PWTouchableOpacity>
    )
}
