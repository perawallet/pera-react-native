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

import type { BannerType } from '@perawallet/wallet-core-banners'
import { PWIcon } from '@components/core'
import type { IconName } from '@components/core/PWIcon/constants'
import type { PWIconSize, PWIconVariant } from '@components/core/PWIcon/types'

const BANNER_TYPE_TO_ICON: Record<BannerType, IconName> = {
    generic: 'sparkle',
    governance: 'shield-check',
    staking: 'locked',
    card: 'card',
    retail: 'gift',
}

type BannerIconProps = {
    type: BannerType
    size?: PWIconSize
    variant?: PWIconVariant
}

export const BannerIcon = ({
    type,
    size = 'md',
    variant = 'primary',
}: BannerIconProps) => (
    <PWIcon
        name={BANNER_TYPE_TO_ICON[type]}
        size={size}
        variant={variant}
    />
)
