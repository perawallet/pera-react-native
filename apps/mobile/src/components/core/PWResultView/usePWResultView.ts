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

import { useMemo } from 'react'
import type { IconName } from '@components/core/PWIcon'
import type { PWResultViewVariant } from './PWResultView'

const VARIANT_ICON: Record<PWResultViewVariant, IconName> = {
    error: 'cross',
    success: 'check',
    warning: 'info',
}

export type UsePWResultViewParams = {
    variant: PWResultViewVariant
    icon?: IconName
}

export type UsePWResultViewResult = {
    iconName: IconName
}

export const usePWResultView = ({
    variant,
    icon,
}: UsePWResultViewParams): UsePWResultViewResult => {
    const iconName = useMemo<IconName>(
        () => icon ?? VARIANT_ICON[variant],
        [icon, variant],
    )

    return { iconName }
}
