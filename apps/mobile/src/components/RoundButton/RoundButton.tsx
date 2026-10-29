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
    PWView,
    PWTouchableOpacity,
    type PWTouchableOpacityProps,
    PWIcon,
    PWText,
    PWRoundIcon,
} from '@components/core'

export type RoundButtonProps = {
    icon: IconName
    title?: string
    /** Lines the title may wrap to before it truncates. */
    titleNumberOfLines?: number
    size?: 'sm' | 'md' | 'lg' | 'xl'
    variant?: 'primary' | 'secondary' | 'destructive'
    badgeIcon?: IconName
    testID?: string
} & PWTouchableOpacityProps

export const RoundButton = (props: RoundButtonProps) => {
    const styles = useStyles()
    const {
        icon,
        title,
        titleNumberOfLines,
        size = 'lg',
        variant = 'secondary',
        badgeIcon,
        style: propStyle,
        testID,
        ...rest
    } = props

    const dimmed = rest.disabled ? styles.dimmed : undefined
    const isDestructive = variant === 'destructive'

    return (
        <PWView style={[styles.container, propStyle]}>
            <PWView style={styles.buttonSlot}>
                <PWTouchableOpacity
                    style={dimmed}
                    testID={testID}
                    {...rest}
                >
                    <PWRoundIcon
                        icon={icon}
                        size={size}
                        variant={isDestructive ? 'error' : variant}
                        style={
                            isDestructive ? styles.destructiveIcon : undefined
                        }
                    />
                </PWTouchableOpacity>
                {badgeIcon ? (
                    <PWView
                        style={styles.badge}
                        pointerEvents='none'
                    >
                        <PWIcon
                            name={badgeIcon}
                            size='xs'
                        />
                    </PWView>
                ) : null}
            </PWView>
            {!!title && (
                <PWText
                    variant='footnoteMedium'
                    truncate
                    numberOfLines={titleNumberOfLines}
                    style={[
                        styles.titleStyle,
                        isDestructive && styles.destructiveTitle,
                        dimmed,
                    ]}
                >
                    {title}
                </PWText>
            )}
        </PWView>
    )
}
