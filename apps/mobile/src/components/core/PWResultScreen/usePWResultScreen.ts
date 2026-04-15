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

import { useMemo } from 'react'
import type { IconName } from '@components/core/PWIcon'
import type { PWResultScreenVariant } from './PWResultScreen'

const VARIANT_ICON: Record<PWResultScreenVariant, IconName> = {
    error: 'cross',
    success: 'check',
    warning: 'info',
}

export type UsePWResultScreenParams = {
    variant: PWResultScreenVariant
    icon?: IconName
}

export type UsePWResultScreenResult = {
    iconName: IconName
}

export const usePWResultScreen = ({
    variant,
    icon,
}: UsePWResultScreenParams): UsePWResultScreenResult => {
    const iconName = useMemo<IconName>(
        () => icon ?? VARIANT_ICON[variant],
        [icon, variant],
    )

    return { iconName }
}
