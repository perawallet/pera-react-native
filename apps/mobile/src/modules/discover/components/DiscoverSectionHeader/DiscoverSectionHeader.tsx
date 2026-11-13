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

import type { ReactNode } from 'react'
import ChevronRight20Icon from '@assets/icons/discover/chevron-right-20.svg'
import { PWText, PWTouchableOpacity, PWView } from '@components/core'
import { useStyles } from './styles'

export type DiscoverSectionHeaderProps = {
    title: string
    /** The section's 24 pt icon from the design. */
    icon?: ReactNode
    onPress?: () => void
    action?: {
        label: string
        icon?: ReactNode
        onPress: () => void
        testID?: string
    }
    testID?: string
}

export const DiscoverSectionHeader = ({
    title,
    icon,
    onPress,
    action,
    testID,
}: DiscoverSectionHeaderProps) => {
    const styles = useStyles()

    const heading = (
        <>
            {icon}
            <PWView style={styles.titleRow}>
                <PWText
                    variant='h3'
                    numberOfLines={1}
                    style={styles.title}
                >
                    {title}
                </PWText>
                {onPress ? <ChevronRight20Icon /> : null}
            </PWView>
        </>
    )

    return (
        <PWView style={styles.header}>
            {onPress ? (
                <PWTouchableOpacity
                    style={styles.heading}
                    onPress={onPress}
                    testID={testID}
                >
                    {heading}
                </PWTouchableOpacity>
            ) : (
                <PWView
                    style={styles.heading}
                    testID={testID}
                >
                    {heading}
                </PWView>
            )}
            {action ? (
                <PWTouchableOpacity
                    style={styles.action}
                    onPress={action.onPress}
                    testID={action.testID}
                >
                    {action.icon}
                    <PWText
                        variant='bodyLarge'
                        weight={500}
                        style={styles.actionLabel}
                    >
                        {action.label}
                    </PWText>
                </PWTouchableOpacity>
            ) : null}
        </PWView>
    )
}
