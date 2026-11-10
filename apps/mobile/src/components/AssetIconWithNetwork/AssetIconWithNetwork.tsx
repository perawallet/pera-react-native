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

import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { PWView } from '@components/core'
import { AssetIcon, type AssetIconProps } from '@components/AssetIcon'
import { ChainAvatarBadge } from '@modules/chain-ui/icon'

export type AssetIconWithNetworkProps = Pick<
    AssetIconProps,
    'asset' | 'chainId' | 'size' | 'logoUrl' | 'shape'
> & {
    /** A chain the wallet runs: its own icon is pinned to the asset's icon. */
    networkChainId?: ChainId
    /** A network the wallet doesn't run, which has no icon of its own. Ignored when `networkChainId` is set. */
    networkLogoUrl?: string
    /** Test id of the badge drawn from `networkLogoUrl`. */
    networkLogoTestID?: string
}

export const AssetIconWithNetwork = ({
    networkChainId,
    networkLogoUrl,
    networkLogoTestID,
    ...icon
}: AssetIconWithNetworkProps) => {
    const renderBadge = () => {
        if (networkChainId) return <ChainAvatarBadge chainId={networkChainId} />
        if (networkLogoUrl) {
            return (
                <ChainAvatarBadge
                    logoUrl={networkLogoUrl}
                    testID={networkLogoTestID}
                />
            )
        }
        return null
    }

    return (
        // AssetIcon clips its own overflow, so the badge sits on a wrapper.
        <PWView>
            <AssetIcon {...icon} />
            {renderBadge()}
        </PWView>
    )
}
