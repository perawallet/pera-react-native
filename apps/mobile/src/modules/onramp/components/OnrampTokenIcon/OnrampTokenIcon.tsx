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

import { AssetIcon } from '@modules/assets/components/AssetIcon'
import type { PWIconSize } from '@components/core'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { RampToken } from '@perawallet/wallet-core-onramp'
import { buildDisplayableAssetFromRampToken } from '../buildDisplayableAssetFromRampToken'

export type OnrampTokenIconProps = {
    token: Nullable<RampToken>
    size?: PWIconSize
    shape?: 'circle' | 'square'
}

export const OnrampTokenIcon = ({
    token,
    size = 'md',
    shape = 'circle',
}: OnrampTokenIconProps) => {
    if (!token) return null

    return (
        <AssetIcon
            asset={buildDisplayableAssetFromRampToken(token)}
            logoUrl={token.logo ?? undefined}
            size={size}
            shape={shape}
        />
    )
}
