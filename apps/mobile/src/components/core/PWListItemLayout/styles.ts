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

import type { DimensionValue } from 'react-native'

type StyleProps = {
    leftFlex: number
    leftMaxWidthRatio?: number
    centerFlex: number
    align: 'center' | 'top'
}

const toPercent = (ratio?: number): DimensionValue | undefined =>
    ratio == null ? undefined : (`${Math.round(ratio * 100)}%` as DimensionValue)

export const useStyles = makeStyles(
    (theme, { leftFlex, leftMaxWidthRatio, centerFlex, align }: StyleProps) => {
        // `top` pins the sticky slots to the first line (multi-line rows like
        // inbox/notifications); `center` is the default single-line behaviour.
        const crossAlign = align === 'top' ? 'flex-start' : 'center'

        return {
            // Sticky leading + flexible body laid out as a row; vertical
            // alignment ignores the divider because the divider is absolutely
            // positioned.
            row: {
                flexDirection: 'row',
                alignItems: crossAlign,
                gap: theme.spacing.lg,
                paddingVertical: theme.spacing.lg,
            },
            // `leftFlex: 0` keeps the slot sticky (content-sized); a positive
            // value lets it grow and — capped by `maxWidth` — truncate its
            // own content.
            left: {
                flexGrow: leftFlex,
                flexShrink: leftFlex > 0 ? 1 : 0,
                maxWidth: toPercent(leftMaxWidthRatio),
            },
            // Anchors the divider: the divider starts at this wrapper's leading
            // edge (the start of the center slot) and runs to the item's
            // trailing edge.
            body: {
                flex: 1,
            },
            contentRow: {
                flexDirection: 'row',
                alignItems: crossAlign,
                gap: theme.spacing.lg,
            },
            center: {
                flexGrow: centerFlex,
                flexShrink: 1,
            },
            // Sticky trailing slot — never shrinks, so it always shows in full
            // and the center truncates first.
            right: {
                flexShrink: 0,
            },
            // Absolutely positioned so it doesn't add height (which would push
            // the sticky slots off vertical-center). Pulled down by the row's
            // bottom padding so it sits on the item's bottom edge, spanning
            // center-start → item-end.
            divider: {
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: -theme.spacing.lg,
                height: theme.borders.sm,
                backgroundColor: theme.colors.layerGrayLighter,
            },
        }
    },
)
