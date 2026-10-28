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

export const useStyles = makeStyles(theme => ({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        // Any bottom padding opts out of PWScrollView's tab-bar inset padding,
        // which would leave a gap under a single row of chips.
        paddingBottom: 0,
    },
    chip: {
        paddingVertical: theme.spacing.xs,
        paddingHorizontal: theme.spacing.lg,
        borderRadius: theme.borderRadius.full,
        borderWidth: theme.borders.sm,
        borderColor: theme.colors.layerGray,
    },
    activeChip: {
        backgroundColor: theme.colors.layerGrayLighter,
    },
    label: {
        ...getFontWeightVariant(theme, 'body', 500),
        color: theme.colors.textGrayLighter,
    },
    activeLabel: getFontWeightVariant(theme, 'body', 500),
}))
