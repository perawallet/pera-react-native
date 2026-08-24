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

import { type TextStyle } from 'react-native'
import { makeStyles } from '@rneui/themed'
import { getTypography } from '@theme/typography'

export const useStyles = makeStyles(theme => {
    const tagText: TextStyle = {
        ...getTypography(theme, 'caption'),
        color: theme.colors.textMain,
        marginLeft: theme.spacing.xs,
    }
    return {
        container: {
            flex: 1,
            backgroundColor: theme.colors.background,
        },
        contentContainer: {
            paddingTop: theme.spacing.lg,
            paddingBottom: theme.spacing.xl,
            paddingHorizontal: theme.spacing.xl,
        },
        header: {
            paddingVertical: theme.spacing.md,
        },
        assetRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: theme.spacing.sm,
        },
        headerIcons: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
        },

        chartContainer: {
            marginTop: theme.spacing.xl,
            gap: theme.spacing.md,
            marginBottom: theme.spacing.xl,
        },
        discoverButton: {
            backgroundColor: theme.colors.layerGrayLighter,
            borderRadius: theme.spacing.sm,
            padding: theme.spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            marginBottom: theme.spacing.md,
            marginTop: theme.spacing.md,
        },
        discoverText: {
            color: theme.colors.textGray,
            flex: 1,
            minWidth: 0,
        },
        discoverLink: {
            flexDirection: 'row',
            alignItems: 'center',
            flexShrink: 0,
        },
        discoverLinkText: {
            marginRight: theme.spacing.xs,
            flexShrink: 1,
        },
        tagText,
        tagTextPresent: {
            color: theme.colors.suspiciousBannerContent,
        },
        tagsContainer: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: theme.spacing.sm,
            marginTop: theme.spacing.lg,
        },
        tag: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
            borderRadius: theme.borderRadius.sm,
            backgroundColor: theme.colors.layerGrayLighter,
            flexShrink: 1,
            minWidth: 0,
        },
        tagPresent: {
            backgroundColor: theme.colors.suspiciousBannerBg,
        },
        loadingContainer: {
            padding: theme.spacing.xl,
            gap: theme.spacing.md,
        },
        trendContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.md,
        },
        // Mirrors the account overview's dateDisplay: flexGrow claims the rest
        // of the row so the scrub date sits hard right, off the trend figures.
        dateDisplay: {
            color: theme.colors.textGray,
            textAlign: 'right',
            flexGrow: 1,
        },
        priceContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
    }
})
