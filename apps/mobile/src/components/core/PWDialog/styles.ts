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

import type { EdgeInsets } from 'react-native-safe-area-context'

const DIALOG_MAX_WIDTH = 560
// At/above this width use the larger horizontal margin (tablet / large screen).
const LARGE_SCREEN_WIDTH = 600

type StyleProps = {
    width: number
    height: number
    insets: EdgeInsets
    maxHeightRatio: number
}

export const useStyles = makeStyles(
    (theme, { width, height, insets, maxHeightRatio }: StyleProps) => {
        const horizontalMargin =
            width >= LARGE_SCREEN_WIDTH
                ? theme.spacing['3xl']
                : theme.spacing.xl
        // The wrapper respects the safe area; the dialog box sizes within it.
        const availableHeight = height - insets.top - insets.bottom

        return {
            backdrop: {
                backgroundColor: theme.colors.backdropModalBg,
            },
            // Centered dialog box: width caps at 560 (shrinking to the screen
            // minus responsive margins); height caps at a ratio of the safe
            // window so tall content scrolls inside instead of overflowing.
            overlay: {
                width: Math.min(width - horizontalMargin * 2, DIALOG_MAX_WIDTH),
                maxWidth: '100%',
                maxHeight: Math.round(availableHeight * maxHeightRatio),
                borderRadius: theme.borderRadius.lg,
                backgroundColor: theme.colors.background,
                padding: 0,
                overflow: 'hidden',
            },
            // Column inside the box: lets the scroll shrink so the footer stays
            // pinned. Carries the modal accessibility marker.
            dialog: {
                flexShrink: 1,
            },
            header: {
                paddingHorizontal: theme.spacing.xl,
                paddingTop: theme.spacing.xl,
            },
            title: {
                textAlign: 'center',
                width: '100%',
            },
            scrollArea: {
                flexShrink: 1,
            },
            content: {
                padding: theme.spacing.xl,
            },
            // Fixed footer: 24 horizontal, 12 bottom (per layout rules).
            footer: {
                paddingHorizontal: theme.spacing.xl,
                paddingTop: theme.spacing.md,
                paddingBottom: theme.spacing.md,
            },
        }
    },
)
