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

import { makeStyles } from '@rneui/themed'
import type { SyncBadge } from '../../hooks/useBackupSyncStatus'

type SyncStatusBadgeStyleProps = {
    status: SyncBadge
}

export const useStyles = makeStyles(
    (theme, { status }: SyncStatusBadgeStyleProps) => {
        const palette = {
            success: {
                backgroundColor: theme.colors.positiveLighter,
                color: theme.colors.positive,
            },
            failed: {
                backgroundColor: theme.colors.negativeLighter,
                color: theme.colors.negative,
            },
            syncing: {
                backgroundColor: theme.colors.layerGrayLighter,
                color: theme.colors.textGray,
            },
        }[status]

        return {
            container: {
                alignSelf: 'flex-start',
                paddingHorizontal: theme.spacing.sm,
                paddingVertical: theme.spacing.xs,
                borderRadius: theme.borderRadius.sm,
                backgroundColor: palette.backgroundColor,
            },
            text: {
                color: palette.color,
            },
        }
    },
)
