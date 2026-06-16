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
import { StyleSheet } from 'react-native'
import { getTypography } from '@theme/typography'

import type { CurrencyAmountProps } from './CurrencyAmount'

const SKELETON_MAX_WIDTH = 150

export const useStyles = makeStyles((theme, props: CurrencyAmountProps) => {
    // Sizes the skeleton bar to match the rendered text.
    const fontSize =
        StyleSheet.flatten(props.style)?.fontSize ??
        getTypography(theme, props.variant ?? 'body').fontSize ??
        theme.spacing.lg

    return {
        container: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: props.alignRight ? 'flex-end' : 'flex-start',
            gap: theme.spacing.xs,
            backgroundColor: 'transparent',
            flexShrink: 1,
            minWidth: 0,
            maxWidth: '100%',
        },
        skeleton: {
            maxWidth: SKELETON_MAX_WIDTH,
            height: fontSize,
        },
        textContainer: {
            alignItems: props.alignRight ? 'flex-end' : 'flex-start',
            flexShrink: 1,
            minWidth: 0,
        },
        // The Algo glyph must never shrink/clip — the amount text yields first.
        symbol: {
            flexShrink: 0,
        },
    }
})
