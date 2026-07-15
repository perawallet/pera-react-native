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
import { getTypography } from '@theme/typography'

export const useStyles = makeStyles(theme => ({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    scrollContent: {
        paddingHorizontal: theme.spacing.md,
        paddingBottom: theme.spacing.xl,
        paddingTop: theme.spacing.md,
        gap: theme.spacing.md,
    },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing.lg,
        gap: theme.spacing.md,
    },
    intro: {
        marginBottom: theme.spacing.xs,
        color: theme.colors.textGray,
    },
    dbCard: {
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.md,
        backgroundColor: theme.colors.layerGrayLighter,
        gap: theme.spacing.sm,
    },
    dbCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.xs,
    },
    dbCardTitle: {
        flexShrink: 1,
    },
    dbCardRange: {
        color: theme.colors.textGray,
    },
    versionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
    },
    versionLabel: {
        flex: 1,
        color: theme.colors.textMain,
    },
    snapshotNote: {
        color: theme.colors.textGray,
    },
    versionChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xxs,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.xs,
        borderRadius: theme.borderRadius.sm,
        backgroundColor: theme.colors.layerGray,
    },
    versionChipText: {
        ...getTypography(theme, 'bodySemibold'),
    },
    lastGenerated: {
        color: theme.colors.textGray,
    },
    qaToggle: {
        gap: theme.spacing.xs,
    },
    qaToggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
    },
    qaCheckboxContainer: {
        padding: 0,
        margin: 0,
        marginLeft: 0,
        marginRight: 0,
        backgroundColor: 'transparent',
    },
    qaToggleLabel: {
        flex: 1,
        color: theme.colors.textMain,
    },
    qaToggleHint: {
        color: theme.colors.textGray,
    },
    actionsRow: {
        flexDirection: 'row',
        gap: theme.spacing.xs,
    },
    actionButton: {
        flex: 1,
    },
    resultPanel: {
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.md,
        backgroundColor: theme.colors.layerGrayLighter,
        gap: theme.spacing.sm,
    },
    resultTitle: {
        marginBottom: theme.spacing.xxs,
    },
    resultRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
    },
    resultStatusIcon: {
        width: theme.spacing.xl,
        alignItems: 'center',
    },
    resultDbName: {
        flex: 1,
        ...getTypography(theme, 'bodySemibold'),
    },
    resultDetail: {
        color: theme.colors.textGray,
    },
}))
