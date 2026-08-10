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

export const useStyles = makeStyles(theme => ({
    // Sticky header owns its own padding (PWSheetLayout's header slot adds none).
    header: {
        paddingHorizontal: theme.spacing.xl,
        paddingTop: theme.spacing.md,
        paddingBottom: theme.spacing.lg,
        gap: theme.spacing.lg,
    },
    // Header already supplies the top gap, so cancel PWSheetLayout's body paddingTop.
    body: {
        gap: theme.spacing.lg,
    },
    title: {
        textAlign: 'center',
    },
    badgesRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: theme.spacing.sm,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.xs,
        borderRadius: theme.spacing.xl,
        backgroundColor: theme.colors.layerGrayLighter,
    },
    badgeText: {
        color: theme.colors.textMain,
    },
    failureBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.spacing.xl,
        backgroundColor: theme.colors.negativeLighter,
        alignSelf: 'center',
    },
    failureBannerText: {
        color: theme.colors.negative,
        flexShrink: 1,
    },
    successBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.spacing.xl,
        backgroundColor: theme.colors.positiveLighter,
        alignSelf: 'center',
    },
    successBannerText: {
        color: theme.colors.positive,
    },
    submittingBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.spacing.xl,
        backgroundColor: theme.colors.layerGrayLighter,
        alignSelf: 'center',
    },
    submittingBannerText: {
        color: theme.colors.textMain,
        flexShrink: 1,
    },
    loadingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: theme.spacing['5xl'],
    },
    errorContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.lg,
        paddingVertical: theme.spacing['3xl'],
        paddingHorizontal: theme.spacing.xl,
    },
    errorText: {
        color: theme.colors.textGray,
        textAlign: 'center',
    },
    accountsHeader: {
        gap: theme.spacing.xs,
    },
    accountsHelpText: {
        color: theme.colors.textGray,
    },
    signersList: {
        gap: theme.spacing.sm,
    },
    actionsRow: {
        flexDirection: 'row',
        gap: theme.spacing.sm,
    },
    actionButton: {
        flex: 1,
    },
}))
