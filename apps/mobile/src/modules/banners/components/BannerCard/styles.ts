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
import { palette } from '@theme/colors'
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
        backgroundColor: palette.gray[700],
        paddingHorizontal: theme.spacing.xl,
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.xl,
        justifyContent: 'space-between',
    },
    topGroup: {
        gap: theme.spacing.md,
    },
    bottomGroup: {
        gap: theme.spacing.sm,
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
        color: theme.colors.textWhite,
    },
    subtitle: {
        ...getTypography(theme, 'body'),
        color: theme.colors.textWhite,
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
        color: theme.colors.textWhite,
        textDecorationLine: 'underline',
    },
}))
