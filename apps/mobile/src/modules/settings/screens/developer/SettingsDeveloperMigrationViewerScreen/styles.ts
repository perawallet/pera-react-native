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
        gap: theme.spacing.xxs,
    },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing.lg,
        gap: theme.spacing.md,
    },
    statusBanner: {
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.md,
        backgroundColor: theme.colors.layerGrayLighter,
        gap: theme.spacing.xxs,
        marginTop: theme.spacing.md,
        marginBottom: theme.spacing.xs,
    },
    statusBannerTitle: {
        margin: 0,
        padding: 0,
        marginBottom: theme.spacing.xs,
    },
    actionsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        rowGap: theme.spacing.xs,
        columnGap: theme.spacing.xs,
        marginBottom: theme.spacing.xs,
    },
    devToolsDivider: {
        height: theme.borders.sm,
        backgroundColor: theme.colors.layerGray,
        marginTop: theme.spacing.xs,
        marginBottom: theme.spacing.xs,
    },
    devToolsLabel: {
        color: theme.colors.textGray,
        marginBottom: theme.spacing.xxs,
    },
    devToolsRow: {
        flexDirection: 'row',
        gap: theme.spacing.xs,
        marginBottom: theme.spacing.sm,
    },
    devToolsButton: {
        flex: 1,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: theme.spacing.sm,
        borderBottomWidth: theme.borders.sm,
        borderBottomColor: theme.colors.layerGrayLighter,
    },
    sectionHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    sectionTitle: {
        margin: 0,
        padding: 0,
    },
    countChip: {
        paddingHorizontal: theme.spacing.xs,
        paddingVertical: theme.spacing.xxs,
        borderRadius: theme.borderRadius.full,
        backgroundColor: theme.colors.layerGray,
        minWidth: theme.spacing.xl,
        alignItems: 'center',
    },
    countChipText: {
        margin: 0,
        padding: 0,
    },
    sectionBody: {
        paddingLeft: theme.spacing.sm,
        paddingTop: theme.spacing.xs,
        paddingBottom: theme.spacing.sm,
        gap: theme.spacing.xxs,
    },
    inlineRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingVertical: theme.spacing.xxs,
        gap: theme.spacing.sm,
    },
    inlineRowLabel: {
        margin: 0,
        padding: 0,
        flexShrink: 0,
    },
    inlineRowValue: {
        margin: 0,
        padding: 0,
        flex: 1,
        textAlign: 'right',
    },
    stackedRow: {
        paddingVertical: theme.spacing.xxs,
        gap: theme.spacing.xxs,
    },
    stackedRowLabel: {
        margin: 0,
        padding: 0,
    },
    stackedRowValue: {
        margin: 0,
        padding: 0,
    },
    monospaceValue: {
        ...getTypography(theme, 'mono'),
    },
    empty: {
        paddingVertical: theme.spacing.xs,
        opacity: 0.6,
    },
    accountCard: {
        backgroundColor: theme.colors.layerGrayLighter,
        borderRadius: theme.borderRadius.md,
        marginBottom: theme.spacing.xs,
    },
    accountCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.sm,
        gap: theme.spacing.sm,
    },
    accountCardHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        flex: 1,
        minWidth: 0,
    },
    accountTypeBadgeGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xxs,
    },
    accountTypeBadge: {
        paddingHorizontal: theme.spacing.xs,
        paddingVertical: theme.spacing.xxs,
        borderRadius: theme.borderRadius.sm,
        backgroundColor: theme.colors.layerGray,
    },
    legacyTypeBadge: {
        paddingHorizontal: theme.spacing.xs,
        paddingVertical: theme.spacing.xxs,
        borderRadius: theme.borderRadius.sm,
        borderWidth: theme.borders.sm,
        borderColor: theme.colors.layerGray,
        backgroundColor: 'transparent',
    },
    badgeArrow: {
        margin: 0,
        padding: 0,
    },
    accountTypeBadgeText: {
        margin: 0,
        padding: 0,
    },
    accountCardAddress: {
        margin: 0,
        padding: 0,
        flex: 1,
    },
    accountCardBody: {
        paddingHorizontal: theme.spacing.sm,
        paddingBottom: theme.spacing.sm,
        gap: theme.spacing.xxs,
    },
    subBlock: {
        marginTop: theme.spacing.xs,
        paddingLeft: theme.spacing.sm,
        borderLeftWidth: theme.borders.sm,
        borderLeftColor: theme.colors.layerGray,
        gap: theme.spacing.xxs,
    },
    subBlockTitle: {
        margin: 0,
        padding: 0,
        marginBottom: theme.spacing.xxs,
    },
    comparisonRow: {
        paddingVertical: theme.spacing.xxs,
        gap: theme.spacing.xxs,
    },
    comparisonHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    comparisonLabel: {
        margin: 0,
        padding: 0,
        flexShrink: 1,
    },
    comparisonStatus: {
        margin: 0,
        padding: 0,
        marginLeft: theme.spacing.xs,
        ...getTypography(theme, 'mono'),
    },
    comparisonStatusOk: {
        color: theme.colors.positive,
    },
    comparisonStatusWarn: {
        color: theme.colors.negative,
    },
    comparisonLine: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingLeft: theme.spacing.sm,
        gap: theme.spacing.xs,
    },
    comparisonTag: {
        margin: 0,
        padding: 0,
        // lanekeep-ignore-next-line pera/no-numeric-sizes reason: fixed column width chosen to align mono comparison labels in the dev viewer; no theme spacing token matches
        width: 64,
        color: theme.colors.layerGray,
        ...getTypography(theme, 'mono'),
    },
    comparisonValue: {
        margin: 0,
        padding: 0,
        flexShrink: 1,
        flex: 1,
        ...getTypography(theme, 'mono'),
    },
}))
