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

import type { Theme } from '@rneui/themed'

export type PWIconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | '3xl'

export const getIconPixelSize = (theme: Theme, size: PWIconSize): number =>
    ({
        xs: theme.spacing.md,
        sm: theme.spacing.lg,
        md: theme.spacing.xl,
        lg: theme.spacing.xxl,
        xl: theme.spacing['3xl'],
        xxl: theme.spacing['4xl'],
        '3xl': theme.spacing['5xl'],
    })[size]

export type PWIconVariant =
    | 'primary'
    | 'buttonPrimary'
    | 'secondary'
    | 'helper'
    | 'white'
    | 'link'
    | 'error'
    | 'positive'
    | 'negative'
    | 'warning'
    | 'brand'
    | 'favorite'
    | 'banner'
