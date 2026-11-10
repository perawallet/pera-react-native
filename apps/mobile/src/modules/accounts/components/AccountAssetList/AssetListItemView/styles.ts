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
import { getIconPixelSize } from '@components/core'
import { getFontWeightVariant } from '@theme/typography'

export const useStyles = makeStyles(theme => ({
    amount: {
        color: theme.colors.textGray,
    },
    value: {
        ...getFontWeightVariant(theme, 'h4', 500),
        textAlign: 'right',
    },
    // Tight under its network header, loose above the next one, so each
    // header reads as belonging to the row below it.
    groupMember: {
        marginLeft: theme.spacing.xl,
        marginTop: theme.spacing.sm,
        marginBottom: theme.spacing.lg,
        alignItems: 'flex-start',
    },
    // Starts at the group row's text column: its xl icon plus the row's gap.
    networkHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        marginLeft: getIconPixelSize(theme, 'xl') + theme.spacing.lg,
    },
    networkHeaderLine: {
        flex: 1,
    },
}))
