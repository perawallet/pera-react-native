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
import type { InboxItem as InboxItemModel } from '@perawallet/wallet-core-messages'
import { ChainBadge } from '@components/ChainBadge'
import { PWText, PWTouchableOpacity, PWView } from '@components/core'
import { UnreadIndicator } from '../UnreadIndicator'
import { isPendingAction } from './isPendingAction'
import { useStyles } from './styles'

export type InboxItemShellProps = {
    item: InboxItemModel
    icon: ReactNode
    title: ReactNode
    /**
     * Trailing text shown beside the title on a single-line (`center`) row.
     * Ignored when `align='top'` — use `body` for multi-line content.
     */
    subtitle?: ReactNode
    /**
     * Rich, multi-line content stacked under the title (status rows, badges,
     * CTAs). Pairs with `align='top'`, which pins the indicator/icon to the
     * first line.
     */
    body?: ReactNode
    /**
     * `center` (default) is a single-line row with the indicator/icon centered;
     * `top` pins them to the first line for multi-line `body` content.
     */
    align?: 'center' | 'top'
    /** The chain every inbox item belongs to; shown as a badge only when the wallet spans chains. */
    chainBadgeName?: string
    onPress?: () => void
    testID?: string
}

export const InboxItemShell = ({
    item,
    icon,
    title,
    subtitle,
    body,
    align = 'center',
    chainBadgeName,
    onPress,
    testID,
}: InboxItemShellProps) => {
    const styles = useStyles()

    const isTop = align === 'top'
    const indicator = <UnreadIndicator isUnread={isPendingAction(item)} />
    const titleRow = (
        <PWView style={styles.titleRow}>
            <PWText style={styles.titleText}>{title}</PWText>
            {chainBadgeName ? <ChainBadge name={chainBadgeName} /> : null}
        </PWView>
    )

    return (
        <PWTouchableOpacity
            style={[styles.container, isTop && styles.containerTop]}
            onPress={onPress}
            disabled={!onPress}
            testID={testID}
        >
            {isTop ? (
                <PWView style={styles.indicatorSlot}>{indicator}</PWView>
            ) : (
                indicator
            )}
            {icon}
            {isTop ? (
                <PWView style={styles.content}>
                    {titleRow}
                    {body}
                </PWView>
            ) : (
                <PWView style={styles.messageBox}>
                    {titleRow}
                    {subtitle ? (
                        <PWText
                            variant='caption'
                            style={styles.subtitleText}
                        >
                            {subtitle}
                        </PWText>
                    ) : null}
                </PWView>
            )}
        </PWTouchableOpacity>
    )
}
