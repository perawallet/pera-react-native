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
    PWView,
    PWTouchableOpacity,
    type PWTouchableOpacityProps,
    PWText,
    PWRoundIcon,
} from '@components/core'
import { getTestProps } from '@utils/test-id-helper'

export type RoundButtonProps = {
    icon: IconName
    title?: string
    size?: 'sm' | 'md' | 'lg'
    variant?: 'primary' | 'secondary'
    testID?: string
} & PWTouchableOpacityProps

export const RoundButton = (props: RoundButtonProps) => {
    const styles = useStyles()
    const {
        icon,
        title,
        size = 'lg',
        variant = 'secondary',
        style: propStyle,
        testID,
        ...rest
    } = props

    return (
        <PWView style={[styles.container, propStyle]}>
            <PWTouchableOpacity
                style={styles.buttonWrapper}
                {...getTestProps(testID)}
                {...rest}
            >
                <PWRoundIcon
                    icon={icon}
                    size={size}
                    variant={variant}
                />
            </PWTouchableOpacity>
            {!!title && (
                <PWText
                    variant='footnoteMedium'
                    truncate
                    style={styles.titleStyle}
                >
                    {title}
                </PWText>
            )}
        </PWView>
    )
}
