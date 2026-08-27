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
        flexDirection: 'column',
        backgroundColor: theme.colors.background,
    },
    imageHalf: {
        flex: 0.45,
        overflow: 'hidden',
        backgroundColor: theme.colors.bannerBg,
    },
    backgroundImage: {
        width: '100%',
        height: '100%',
    },
    contentHalf: {
        flex: 0.55,
        backgroundColor: theme.colors.background,
        paddingHorizontal: theme.spacing.xl,
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.md,
    },
    topGroup: {
        gap: theme.spacing.md,
    },
    // Everything but the art and the CTA scrolls, so the action stays reachable
    // however long the copy runs.
    scrollArea: {
        flex: 1,
    },
    scrollContent: {
        gap: theme.spacing.md,
        // Explicit, so PWScrollView does not add its own safe-area inset — the
        // pinned footer below already sits above it.
        paddingBottom: theme.spacing.md,
    },
    bottomGroup: {
        gap: theme.spacing.sm,
        flexShrink: 0,
    },
    iconBubble: {
        width: theme.spacing['3xl'],
        height: theme.spacing['3xl'],
        borderRadius: theme.borderRadius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.bannerBg,
    },
    title: {
        ...getTypography(theme, 'h2'),
        color: theme.colors.textMain,
    },
    subtitle: {
        ...getTypography(theme, 'body'),
        color: theme.colors.textMain,
    },
    cta: {
        alignSelf: 'stretch',
        marginTop: theme.spacing.md,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.xl,
        borderRadius: theme.borderRadius.full,
        backgroundColor: theme.colors.buttonPrimaryBg,
        alignItems: 'center',
    },
    ctaText: {
        ...getTypography(theme, 'bodySemibold'),
        color: theme.colors.buttonPrimaryText,
    },
    dismissLink: {
        alignSelf: 'center',
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
    },
    dismissLinkText: {
        ...getTypography(theme, 'bodySemibold'),
        color: theme.colors.textMain,
        textDecorationLine: 'underline',
    },
}))
