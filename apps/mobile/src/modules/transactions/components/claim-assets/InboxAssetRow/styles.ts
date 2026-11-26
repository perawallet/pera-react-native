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

// The account asset list's row spacing and type, so the inbox reads the same.
export const useStyles = makeStyles(theme => ({
    row: {
        marginVertical: theme.spacing.lg,
    },
    amount: {
        color: theme.colors.textGray,
    },
    value: {
        ...getFontWeightVariant(theme, 'h4', 500),
        textAlign: 'right',
    },
}))
