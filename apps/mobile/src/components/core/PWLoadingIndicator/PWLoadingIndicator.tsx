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

import { useMemo } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { useTheme } from '@rneui/themed'
import { PWLottie } from '../PWLottie'
import { PWView } from '../PWView'
import { useStyles } from './styles'
import { tintSpinner } from './tintSpinner'

export type PWLoadingIndicatorProps = {
    /** `xl` is for a loader that fills the whole screen. */
    size?: 'sm' | 'lg' | 'xl'
    color?: string
    style?: StyleProp<ViewStyle>
    testID?: string
}

export const PWLoadingIndicator = ({
    size = 'sm',
    color,
    style,
    testID = 'activity-indicator',
}: PWLoadingIndicatorProps) => {
    const { theme } = useTheme()
    const styles = useStyles({ size })
    const source = useMemo(
        () => tintSpinner(color ?? theme.colors.systemElements),
        [color, theme.colors.systemElements],
    )

    return (
        <PWView
            style={[styles.container, style]}
            testID={testID}
            accessibilityRole='progressbar'
        >
            <PWLottie
                source={source}
                autoPlay
                loop
                style={styles.animation}
            />
        </PWView>
    )
}
