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
    planCard: {
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.md,
        backgroundColor: theme.colors.layerGrayLighter,
        gap: theme.spacing.sm,
    },
    planHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.xs,
    },
    planTitle: {
        flexShrink: 1,
    },
    planMeta: {
        color: theme.colors.textGray,
    },
    readerImpact: {
        color: theme.colors.textGray,
        fontStyle: 'italic',
    },
    migrationRow: {
        gap: theme.spacing.xxs,
        paddingVertical: theme.spacing.xs,
        borderTopWidth: theme.borders.sm,
        borderTopColor: theme.colors.layerGray,
    },
    migrationStep: {
        ...getTypography(theme, 'bodySemibold'),
    },
    migrationDescription: {
        color: theme.colors.textMain,
    },
    emptyState: {
        color: theme.colors.textGray,
        textAlign: 'center',
        paddingVertical: theme.spacing.lg,
    },
}))
