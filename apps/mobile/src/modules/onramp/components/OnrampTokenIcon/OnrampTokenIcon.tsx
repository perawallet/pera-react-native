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

import type { RampToken } from '@perawallet/wallet-core-onramp'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { AssetIconWithNetwork } from '@components/AssetIconWithNetwork'
import type { PWIconSize } from '@components/core'
import { useOnrampAccount } from '@modules/onramp/hooks/useOnrampAccount'
import { buildDisplayableAssetFromRampToken } from '../buildDisplayableAssetFromRampToken'

export type OnrampTokenIconProps = {
    token: Nullable<RampToken>
    size?: PWIconSize
    shape?: 'circle' | 'square'
    /** Test id of a network badge drawn from the router's logo. */
    networkLogoTestID?: string
}

export const OnrampTokenIcon = ({
    token,
    size = 'md',
    shape = 'circle',
    networkLogoTestID,
}: OnrampTokenIconProps) => {
    const { scope } = useOnrampAccount()
    if (!token) return null

    return (
        <AssetIconWithNetwork
            chainId={scope?.chainId ?? null}
            asset={buildDisplayableAssetFromRampToken(token, scope)}
            logoUrl={token.logo ?? undefined}
            size={size}
            shape={shape}
            networkChainId={token.network.chainId}
            networkLogoUrl={token.network.logo ?? undefined}
            networkLogoTestID={networkLogoTestID}
        />
    )
}
