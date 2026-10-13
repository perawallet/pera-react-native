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
    list: {
        flex: 1,
    },
    listContent: {
        paddingBottom: theme.spacing.xl,
    },
    content: {
        paddingTop: theme.spacing.lg,
        gap: theme.spacing.xxl,
    },
    heroSection: {
        alignItems: 'center',
        gap: theme.spacing.lg,
    },
    artwork: {
        alignSelf: 'stretch',
        alignItems: 'center',
    },
    hero: {
        width: '100%',
        maxWidth: theme.spacing['5xl'] * 3,
        height: theme.spacing['5xl'] * 2,
    },
    balanceSection: {
        alignItems: 'center',
        alignSelf: 'stretch',
        gap: theme.spacing.sm,
    },
    balance: {
        textAlign: 'center',
    },
    balanceSkeleton: {
        width: theme.spacing['5xl'] * 2,
        height: theme.spacing['3xl'],
        borderRadius: theme.spacing.sm,
    },
    secondaryText: {
        color: theme.colors.textGray,
    },
    centeredText: {
        textAlign: 'center',
        color: theme.colors.textGray,
    },
    status: {
        alignItems: 'center',
        gap: theme.spacing.xs,
        paddingTop: theme.spacing.md,
        paddingHorizontal: theme.spacing.sm,
    },
    guide: {
        backgroundColor: theme.colors.layerGrayLightest,
        borderRadius: theme.spacing.lg,
        padding: theme.spacing.xl,
        gap: theme.spacing.lg,
    },
    guideRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
    },
    iconContainer: {
        backgroundColor: theme.colors.background,
        borderRadius: theme.spacing.md,
        padding: theme.spacing.md,
    },
    guideText: {
        flex: 1,
        gap: theme.spacing.xs,
    },
    // The list's section headers follow; this only needs a little breathing
    // room from the guide card above it.
    historyTitle: {
        paddingBottom: theme.spacing.xs,
    },
    loadingFooter: {
        paddingVertical: theme.spacing.lg,
        alignItems: 'center',
    },
}))
