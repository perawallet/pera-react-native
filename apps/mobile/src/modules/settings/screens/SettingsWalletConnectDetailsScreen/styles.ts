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

const NETWORK_TEXT_FONT_SIZE = 10

export const useStyles = makeStyles(theme => {
    const mainnetText = {
        ...getTypography(theme, 'caption'),
        color: theme.colors.positive,
        textTransform: 'uppercase' as const,
        fontSize: NETWORK_TEXT_FONT_SIZE,
    }
    const testnetText = {
        ...getTypography(theme, 'caption'),
        color: theme.colors.testnetBg,
        textTransform: 'uppercase' as const,
        fontSize: NETWORK_TEXT_FONT_SIZE,
    }
    return {
        container: {
            flex: 1,
            gap: theme.spacing.lg,
            alignItems: 'flex-start',
        },
        versionContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            // The parent column aligns to flex-start, so without stretching
            // this row it sizes to its content and the badge + label ran off
            // the right edge once the label scaled up.
            alignSelf: 'stretch',
        },
        icon: {
            width: theme.spacing['3xl'],
            height: theme.spacing['3xl'],
            borderRadius: theme.spacing.xl,
        },
        link: {
            color: theme.colors.positive,
        },
        description: {
            color: theme.colors.textGray,
        },
        version: {
            color: theme.colors.textGray,
            // Row children don't shrink by default in RN, so the label has to
            // opt in before it will wrap next to the badge.
            flexShrink: 1,
        },
        connectionContainer: {
            padding: theme.spacing.md,
            borderRadius: theme.spacing.md,
            backgroundColor: theme.colors.layerGrayLighter,
            width: '100%',
        },
        createdAt: {
            color: theme.colors.textGray,
            flexGrow: 1,
            textAlign: 'right',
            alignSelf: 'flex-end',
        },
        accountDisplay: {
            flexGrow: 1,
        },
        networkContainer: {
            alignItems: 'center',
            gap: theme.spacing.xs,
        },
        mainnetText,
        testnetText,
        accountContainer: {
            marginTop: theme.spacing.md,
            gap: theme.spacing.lg,
        },
        accountRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            width: '100%',
        },

        permissionsContainer: {
            marginTop: theme.spacing.lg,
            gap: theme.spacing.sm,
            width: '100%',
        },
        permissionsTitle: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            paddingVertical: theme.spacing.md,
        },
        deleteContainer: {
            flexGrow: 1,
            width: '100%',
            justifyContent: 'flex-end',
        },
    }
})
