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
import type { SyncBadge } from './useCloudBackupOverview'

export const useStyles = makeStyles(theme => ({
    container: {
        gap: theme.spacing.xl,
    },
    section: {
        gap: theme.spacing.md,
    },
    sectionLabel: {
        paddingHorizontal: theme.spacing.sm,
        color: theme.colors.textMain,
    },
    rows: {
        gap: theme.spacing.md,
    },
}))

type OverviewRowStyleProps = {
    variant: 'filled' | 'bordered'
    tone: 'default' | 'negative'
}

export const useOverviewRowStyles = makeStyles(
    (theme, { variant, tone }: OverviewRowStyleProps) => ({
        row: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.lg,
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
            borderRadius: theme.borderRadius.md,
            backgroundColor:
                variant === 'filled'
                    ? theme.colors.layerGrayLighter
                    : theme.colors.background,
            borderWidth:
                variant === 'bordered' ? theme.borders.sm : theme.borders.none,
            borderColor: theme.colors.layerGray,
        },
        textContainer: {
            flex: 1,
            minWidth: 0,
        },
        titleRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.xs,
        },
        title: {
            color:
                tone === 'negative'
                    ? theme.colors.negative
                    : theme.colors.textMain,
        },
        subtitleRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.xs,
        },
        subtitle: {
            color: theme.colors.textGray,
        },
    }),
)

type SyncStatusBadgeStyleProps = {
    status: SyncBadge
}

export const useSyncStatusBadgeStyles = makeStyles(
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
