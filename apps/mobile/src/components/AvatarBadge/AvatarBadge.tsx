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
import { PWView } from '@components/core'
import { useStyles } from './styles'

export type AvatarBadgeProps = {
    children: ReactNode
}

/** Corner-badge shell for AccountDisplay's `avatarBadge` slot: content up to `theme.spacing.lg` square fills the disc, wider content widens it. */
export const AvatarBadge = ({ children }: AvatarBadgeProps) => {
    const styles = useStyles()

    return (
        <PWView
            style={styles.ring}
            testID='avatar_badge'
        >
            <PWView style={styles.disc}>{children}</PWView>
        </PWView>
    )
}
