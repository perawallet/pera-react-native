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
import {
    PWIcon,
    PWSkeleton,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import type { TypographyVariant } from '@theme/typography'
import { useStyles } from './styles'

export type OnrampSelectionRowProps = {
    label: string
    value: string
    onPress: () => void
    isLoading?: boolean
    isPlaceholder?: boolean
    badge?: ReactNode
    skeletonWidth?: number
    valueVariant?: TypographyVariant
    labelVariant?: TypographyVariant
    testID?: string
}

const DEFAULT_SKELETON_WIDTH = 100

export const OnrampSelectionRow = ({
    label,
    value,
    onPress,
    isLoading = false,
    isPlaceholder = false,
    badge,
    skeletonWidth = DEFAULT_SKELETON_WIDTH,
    valueVariant = 'body',
    labelVariant = 'footnoteMedium',
    testID,
}: OnrampSelectionRowProps) => {
    const styles = useStyles()

    return (
        <PWTouchableOpacity
            style={styles.row}
            onPress={onPress}
            testID={testID}
        >
            <PWText
                variant={labelVariant}
                style={styles.label}
            >
                {label}
            </PWText>
            <PWView style={styles.valueGroup}>
                {isLoading ? (
                    <PWSkeleton
                        width={skeletonWidth}
                        height={20}
                    />
                ) : (
                    <PWView style={styles.valueGroup}>
                        <PWText
                            variant={valueVariant}
                            truncate
                            style={
                                isPlaceholder
                                    ? styles.placeholder
                                    : styles.value
                            }
                        >
                            {value}
                        </PWText>
                        {badge}
                    </PWView>
                )}
                <PWIcon
                    name='chevron-right'
                    size='xs'
                    variant='secondary'
                />
            </PWView>
        </PWTouchableOpacity>
    )
}
