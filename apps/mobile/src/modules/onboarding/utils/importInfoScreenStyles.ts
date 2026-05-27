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
import type { EdgeInsets } from 'react-native-safe-area-context'
import type { TextStyle, ViewStyle } from 'react-native'

// Shared layout for the onboarding import-info screens (ASB / Pera Web), which
// share an identical header-body-footer layout inset from the safe area.
export const getImportInfoScreenStyles = (
    theme: Theme,
    insets: EdgeInsets,
): Record<
    'root' | 'content' | 'title' | 'description' | 'footer',
    ViewStyle | TextStyle
> => ({
    root: {
        flex: 1,
        backgroundColor: theme.colors.background,
        marginBottom: insets.bottom,
    },
    content: {
        flex: 1,
        alignItems: 'flex-start',
        paddingHorizontal: theme.spacing.xl,
        paddingTop: theme.spacing.xl,
        gap: theme.spacing.lg,
    },
    title: {
        textAlign: 'left',
    },
    description: {
        textAlign: 'left',
        color: theme.colors.textGray,
    },
    footer: {
        padding: theme.spacing.xl,
        paddingBottom: theme.spacing.xxl,
    },
})
