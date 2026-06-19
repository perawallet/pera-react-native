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
        gap: theme.spacing.xl,
    },
    label: {
        ...getTypography(theme, 'footnoteMedium'),
        color: theme.colors.textGrayLighter,
    },
    errorMessage: {
        marginTop: theme.spacing.xs,
        marginBottom: 0,
        minHeight: theme.spacing.lg,
    },
    // City + ZIP sit side by side.
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing.xl,
    },
    rowItem: {
        flex: 1,
    },
    checkboxes: {
        gap: theme.spacing.md,
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
    },
    checkboxLabel: {
        flex: 1,
        color: theme.colors.textGray,
    },
}))
