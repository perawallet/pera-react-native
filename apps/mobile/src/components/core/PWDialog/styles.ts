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

import { CONTROL_MAX_WIDTH_DP } from '@constants/ui'
import { isLargeScreen } from '@utils/screen'

import type { EdgeInsets } from 'react-native-safe-area-context'

type StyleProps = {
    width: number
    height: number
    insets: EdgeInsets
    maxHeightRatio: number
}

export const useStyles = makeStyles(
    (theme, { width, height, insets, maxHeightRatio }: StyleProps) => {
        const horizontalMargin = isLargeScreen(width, height)
            ? theme.spacing['3xl']
            : theme.spacing.xl
        const availableHeight = height - insets.top - insets.bottom

        return {
            backdrop: {
                backgroundColor: theme.colors.backdropModalBg,
            },
            overlay: {
                width: Math.min(
                    width - horizontalMargin * 2,
                    CONTROL_MAX_WIDTH_DP,
                ),
                maxWidth: '100%',
                maxHeight: Math.round(availableHeight * maxHeightRatio),
                borderRadius: theme.borderRadius.lg,
                backgroundColor: theme.colors.background,
                padding: 0,
                overflow: 'hidden',
            },
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
            footer: {
                paddingHorizontal: theme.spacing.xl,
                paddingTop: theme.spacing.md,
                paddingBottom: theme.spacing.md,
            },
        }
    },
)
