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

import type { ReactNode } from 'react'
import { PWIcon, PWText, PWToolbar, PWView } from '@components/core'
import { useBottomSheetResult } from '../../hooks/useBottomSheetResult'
import { useBottomSheetPanDownEnabled } from '../../hooks/useBottomSheetPanDownEnabled'
import { useBottomSheetSize } from '../../hooks/useBottomSheetSize'

import type { StyleProp, ViewStyle } from 'react-native'
import type { FontWeight, TypographyVariant } from '@theme/typography'

import { useStyles } from './styles'

export type SheetHeaderProps = {
    title: ReactNode
    titleVariant?: TypographyVariant
    titleWeight?: FontWeight
    subtitle?: string
    rightAction?: ReactNode
    onClose?: () => void
    paddingStyle?: 'normal' | 'dense' | 'none'
    style?: StyleProp<ViewStyle>
    testID?: string
}

/** Bottom-sheet toolbar header; close icon wired to `dismiss()`. */
export const SheetHeader = ({
    title,
    titleVariant = 'h4',
    titleWeight,
    subtitle,
    rightAction,
    onClose,
    paddingStyle = 'dense',
    style,
    testID,
}: SheetHeaderProps) => {
    const styles = useStyles()
    const { dismiss } = useBottomSheetResult()
    const isPanDownEnabled = useBottomSheetPanDownEnabled()
    const size = useBottomSheetSize()
    const handleClose = onClose ?? dismiss

    const isFullScreen = size === 'full' || size === 'modal'
    const showClose = isFullScreen || !isPanDownEnabled

    return (
        <PWToolbar
            left={
                showClose ? (
                    <PWIcon
                        name='cross'
                        variant='primary'
                        onPress={handleClose}
                        testID={testID ? `${testID}-close` : undefined}
                    />
                ) : undefined
            }
            center={
                typeof title !== 'string' ? (
                    title
                ) : subtitle ? (
                    <PWView style={styles.titleColumn}>
                        <PWText
                            variant={titleVariant}
                            weight={titleWeight}
                            truncate
                            style={styles.title}
                            testID={testID ? `${testID}-title` : undefined}
                        >
                            {title}
                        </PWText>
                        <PWText
                            variant='footnoteMedium'
                            weight={400}
                            truncate
                            style={styles.subtitle}
                            testID={testID ? `${testID}-subtitle` : undefined}
                        >
                            {subtitle}
                        </PWText>
                    </PWView>
                ) : (
                    <PWText
                        variant={titleVariant}
                        weight={titleWeight}
                        truncate
                        style={styles.title}
                        testID={testID ? `${testID}-title` : undefined}
                    >
                        {title}
                    </PWText>
                )
            }
            right={rightAction}
            paddingStyle={paddingStyle}
            style={[styles.toolbar, style]}
            testID={testID}
        />
    )
}
