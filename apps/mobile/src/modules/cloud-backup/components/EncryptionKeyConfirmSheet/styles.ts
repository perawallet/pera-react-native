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

// Optional because `makeStyles` types the generated hook's argument as
// optional: only `container` reads the inset, and the sub-components below
// call this with no argument.
type StyleProps = {
    bottomInset?: number
}

export const useStyles = makeStyles(
    (theme, { bottomInset = 0 }: StyleProps = {}) => ({
        container: {
            alignItems: 'center',
            paddingHorizontal: theme.spacing.xl,
            paddingTop: theme.spacing.xl,
            // PWBottomSheet passes `bottomInset={0}`, so sheet contents carry their
            // own safe-area inset — same shape as ConfirmActionContent's.
            paddingBottom: theme.spacing.lg + bottomInset,
            gap: theme.spacing.lg,
        },
        icon: {
            marginBottom: theme.spacing.xs,
        },
        title: {
            textAlign: 'center',
        },
        checkboxRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            alignSelf: 'stretch',
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.md,
            borderRadius: theme.borderRadius.md,
            borderWidth: theme.borders.sm,
            borderColor: theme.colors.layerGray,
        },
        actions: {
            alignSelf: 'stretch',
            gap: theme.spacing.xs,
        },
    }),
)
