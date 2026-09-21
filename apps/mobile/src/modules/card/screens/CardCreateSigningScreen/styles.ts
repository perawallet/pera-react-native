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
    content: {
        paddingTop: theme.spacing.xl,
        gap: theme.spacing.xxl,
    },
    body: {
        color: theme.colors.textGray,
    },
    summary: {
        gap: theme.spacing.lg,
    },
    summaryRow: {
        gap: theme.spacing.xs,
    },
    summaryLabel: {
        color: theme.colors.textGrayLighter,
    },
    summaryHint: {
        color: theme.colors.textGray,
    },
    steps: {
        gap: theme.spacing.xl,
    },
    footer: {
        gap: theme.spacing.sm,
    },
}))
