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
        // No explicit bottom padding — the enclosing `TransactionListFooter`
        // wraps this in a `SafeAreaView edges=['bottom']` that already
        // supplies the safe-area inset. The extra `spacing.lg` here stacked
        // on top of that inset and left a visible gap below the Cancel
        // button on devices with a home indicator.
        gap: theme.spacing.xl,
        backgroundColor: theme.colors.background,
    },
    cannotSignNotice: {
        gap: theme.spacing.xxs,
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.lg,
        backgroundColor: theme.colors.negativeLighter,
    },
    cannotSignBody: {
        color: theme.colors.textGray,
    },
}))
