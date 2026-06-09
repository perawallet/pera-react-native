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
import { getFontWeightVariant } from '@theme/typography'

export const useStyles = makeStyles(theme => ({
    body: {
        flex: 1,
        paddingHorizontal: theme.spacing.xl,
    },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: theme.spacing['3xl'],
    },
    emptyText: {
        color: theme.colors.textGray,
        textAlign: 'center',
    },
    // Search input + filter chips header that scrolls with the list.
    searchContainer: {
        paddingTop: theme.spacing.sm,
    },
    filterRow: {
        flexDirection: 'row',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.md,
        marginTop: theme.spacing.md,
    },
    sectionHeader: {
        color: theme.colors.textGray,
        textTransform: 'uppercase',
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.sm,
    },
    // Row layout: icon + text block
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.lg,
        paddingVertical: theme.spacing.md,
    },
    iconContainer: {
        position: 'relative',
    },
    // Network logo overlaid on the bottom-right of the asset icon, with a
    // surface-colored ring so it reads as a separate badge.
    networkBadge: {
        position: 'absolute',
        right: -theme.spacing.xs,
        bottom: -theme.spacing.xs,
        width: theme.spacing.lg,
        height: theme.spacing.lg,
        borderRadius: theme.borderRadius.full,
        borderWidth: theme.borders.md,
        borderColor: theme.colors.background,
        backgroundColor: theme.colors.background,
        overflow: 'hidden',
    },
    rowTextContainer: {
        flex: 1,
        minWidth: 0,
    },
    rowSubLine: {
        color: theme.colors.textGray,
    },
    seeAllRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing.md,
        gap: theme.spacing.lg,
    },
    seeAllText: {
        ...getFontWeightVariant(theme, 'h4', 400),
    },
}))
