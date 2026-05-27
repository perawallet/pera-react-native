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

import type { Theme } from '@rneui/themed'
import type { ViewStyle } from 'react-native'

// Shared layout for the rekey-to-{ledger,shared,standard} select-target screens.
// Each screen wraps this in its own makeStyles so its style keys stay visible to
// the no-unused-style-keys check.
export const getSelectTargetScreenStyles = (
    theme: Theme,
    bottomPadding: number,
): Record<'container' | 'list', ViewStyle> => ({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    list: {
        flexGrow: 1,
        gap: theme.spacing.sm,
        paddingHorizontal: theme.spacing.xl,
        paddingBottom: bottomPadding,
    },
})
