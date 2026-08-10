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
    description: {
        color: theme.colors.textGray,
        paddingHorizontal: theme.spacing.xl,
        paddingBottom: theme.spacing.md,
    },
    // Matches the account rows in EnableRequestScreen so the two consent
    // surfaces read as one family.
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.xl,
    },
    rowText: {
        flexShrink: 1,
    },
    name: {
        ...getFontWeightVariant(theme, 'body', 600),
        color: theme.colors.textMain,
    },
    secondary: {
        color: theme.colors.textGray,
    },
}))
