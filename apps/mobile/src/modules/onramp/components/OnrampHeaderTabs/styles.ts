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
import { getFontWeightVariant } from '@theme/typography'

const DOT_SIZE = 6

export const useStyles = makeStyles(theme => ({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.lg,
        paddingHorizontal: theme.spacing.sm,
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing.xs,
    },
    label: {
        ...getFontWeightVariant(theme, 'h1', 500),
        color: theme.colors.textGrayLighter,
    },
    activeLabel: {
        ...getFontWeightVariant(theme, 'h1', 700),
        color: theme.colors.textMain,
    },
    // Small "needs attention" dot riding at the top-right of the tab label.
    badge: {
        marginTop: theme.spacing.sm,
        width: DOT_SIZE,
        height: DOT_SIZE,
        borderRadius: theme.borderRadius.full,
        backgroundColor: theme.colors.secondary,
    },
}))
