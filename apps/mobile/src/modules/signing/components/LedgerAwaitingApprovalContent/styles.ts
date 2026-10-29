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

// lanekeep-ignore-next-line pera/no-numeric-sizes reason: approval animation width
const LOTTIE_WIDTH = 164
// lanekeep-ignore-next-line pera/no-numeric-sizes reason: approval animation height
const LOTTIE_HEIGHT = 48

type StyleProps = { progressFillPercent: number; bottomInset: number }

export const useStyles = makeStyles(
    (theme, { progressFillPercent, bottomInset }: StyleProps) => ({
        container: {
            padding: theme.spacing.xl,
            // PWBottomSheet draws edge-to-edge, so the content owns the bottom
            // safe-area inset — without it the footnote renders under the
            // Android nav bar.
            paddingBottom: theme.spacing.xl + bottomInset,
            alignItems: 'center',
        },
        lottie: {
            // Matches Android dialog_ledger_loading.xml (164dp × 48dp).
            width: LOTTIE_WIDTH,
            height: LOTTIE_HEIGHT,
            marginBottom: theme.spacing.lg,
        },
        title: {
            ...getTypography(theme, 'h3'),
            marginBottom: theme.spacing.sm,
            textAlign: 'center',
        },
        body: {
            ...getTypography(theme, 'body'),
            color: theme.colors.textGray,
            textAlign: 'center',
            marginBottom: theme.spacing.xl,
            paddingHorizontal: theme.spacing.lg,
        },
        progressLabel: {
            ...getTypography(theme, 'body'),
            color: theme.colors.textMain,
            textAlign: 'center',
            marginBottom: theme.spacing.sm,
        },
        progressBarTrack: {
            width: '100%',
            height: theme.spacing.xxs,
            backgroundColor: theme.colors.layerGrayLighter,
            borderRadius: theme.borderRadius.full,
            marginBottom: theme.spacing.xl,
            overflow: 'hidden',
        },
        progressBarFill: {
            height: '100%',
            width: `${progressFillPercent}%`,
            backgroundColor: theme.colors.positive,
        },
        cancelButton: {
            width: '100%',
            marginBottom: theme.spacing.lg,
        },
        footnote: {
            ...getTypography(theme, 'body'),
            color: theme.colors.textGray,
            textAlign: 'center',
            paddingHorizontal: theme.spacing.lg,
        },
    }),
)
