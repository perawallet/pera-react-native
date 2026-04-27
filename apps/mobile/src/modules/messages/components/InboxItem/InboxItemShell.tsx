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
import { PWText, PWTouchableOpacity, PWView } from '@components/core'
import type { InboxItem as InboxItemModel } from '@perawallet/wallet-core-messages'
import { UnreadIndicator } from '../UnreadIndicator'
import { isPendingAction } from './isPendingAction'
import { useStyles } from './styles'

export type InboxItemShellProps = {
    item: InboxItemModel
    icon: ReactNode
    title: ReactNode
    subtitle?: ReactNode
    onPress?: () => void
}

export const InboxItemShell = ({
    item,
    icon,
    title,
    subtitle,
    onPress,
}: InboxItemShellProps) => {
    const styles = useStyles()

    return (
        <PWTouchableOpacity
            style={styles.container}
            onPress={onPress}
            disabled={!onPress}
        >
            <UnreadIndicator isUnread={isPendingAction(item)} />
            {icon}
            <PWView style={styles.messageBox}>
                <PWText style={styles.titleText}>{title}</PWText>
                {subtitle ? (
                    <PWText
                        variant='caption'
                        style={styles.subtitleText}
                    >
                        {subtitle}
                    </PWText>
                ) : null}
            </PWView>
        </PWTouchableOpacity>
    )
}
