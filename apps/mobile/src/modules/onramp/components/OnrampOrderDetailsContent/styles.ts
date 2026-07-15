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

export const useStyles = makeStyles(theme => ({
    container: {
        gap: theme.spacing.lg,
    },
    summaryCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        // Subtle turquoise-tinted positive surface matching the Figma green card.
        backgroundColor: theme.colors.positiveLighter,
        borderRadius: theme.borderRadius.md,
        padding: theme.spacing.lg,
    },
    summaryTextColumn: {
        flex: 1,
        gap: theme.spacing.xxs,
    },
    summaryText: {
        color: theme.colors.textMain,
    },
    summaryDate: {
        color: theme.colors.textGray,
    },
    detailsSection: {
        gap: theme.spacing.lg,
    },
}))
