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
import { getTypography } from '@theme/typography'

export const useStyles = makeStyles(theme => ({
    content: {
        paddingTop: theme.spacing.xl,
        gap: theme.spacing.xxl,
    },
    fields: {
        // Tight gap because the email field reserves a constant error line
        // below it (see `errorMessage`), which carries most of the spacing.
        gap: theme.spacing.sm,
    },
    label: {
        ...getTypography(theme, 'footnoteMedium'),
        color: theme.colors.textGrayLighter,
    },
    // Always-rendered error line (RNElements collapses it otherwise) with a
    // constant minHeight so showing/clearing the message never shifts the
    // country field (the one-line message fits within minHeight either way).
    errorMessage: {
        marginTop: theme.spacing.xs,
        marginBottom: 0,
        minHeight: theme.spacing.lg,
    },
}))
