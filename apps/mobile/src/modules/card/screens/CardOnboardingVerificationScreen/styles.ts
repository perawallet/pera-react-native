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

const HERO_HEIGHT = 210

export const useStyles = makeStyles(theme => ({
    content: {
        paddingTop: theme.spacing.sm,
    },
    hero: {
        width: '100%',
        height: HERO_HEIGHT,
    },
    poweredByRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        marginTop: theme.spacing.xl,
    },
    poweredByText: {
        color: theme.colors.textGray,
    },
    baanxLogo: {
        width: theme.spacing['4xl'],
        height: theme.spacing.md,
    },
    title: {
        marginTop: theme.spacing.lg,
        textAlign: 'center',
    },
    callout: {
        marginTop: theme.spacing.xxl,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing.lg,
        paddingTop: theme.spacing.lg,
        paddingLeft: theme.spacing.lg,
        paddingHorizontal: theme.spacing['3xl'],
        paddingBottom: theme.spacing.xl,
        borderWidth: theme.borders.sm,
        borderColor: theme.colors.favorite,
        borderRadius: theme.spacing.lg,
        backgroundColor: theme.colors.warningSurface,
    },
    calloutIcon: {
        padding: theme.spacing.sm,
        borderRadius: theme.spacing.xl,
        backgroundColor: theme.colors.background,
        // Subtle elevation matching the design's Light/Card/Shadow on the circle.
        ...theme.shadows.sm,
    },
    calloutColumn: {
        flex: 1,
        gap: theme.spacing.lg,
    },
    calloutTexts: {
        gap: theme.spacing.sm,
    },
    calloutBody: {
        color: theme.colors.textGray,
    },
    footer: {
        gap: theme.spacing.md,
    },
    contactText: {
        textAlign: 'center',
        color: theme.colors.textGrayLighter,
    },
}))
