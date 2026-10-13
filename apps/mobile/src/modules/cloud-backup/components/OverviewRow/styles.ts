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

type OverviewRowStyleProps = {
    variant: 'filled' | 'bordered'
    tone: 'default' | 'negative'
}

export const useStyles = makeStyles(
    (theme, { variant, tone }: OverviewRowStyleProps) => ({
        row: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.lg,
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
            borderRadius: theme.borderRadius.md,
            backgroundColor:
                variant === 'filled'
                    ? theme.colors.layerGrayLighter
                    : theme.colors.background,
            borderWidth:
                variant === 'bordered' ? theme.borders.sm : theme.borders.none,
            borderColor: theme.colors.layerGray,
        },
        textContainer: {
            flex: 1,
            minWidth: 0,
        },
        title: {
            color:
                tone === 'negative'
                    ? theme.colors.negative
                    : theme.colors.textMain,
        },
        subtitleRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.xs,
        },
        subtitle: {
            color: theme.colors.textGray,
        },
    }),
)
