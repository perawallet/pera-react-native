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

import { type DisplayableAsset } from '@perawallet/wallet-core-assets'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import {
    AssetSelectorContent,
    type AssetSelectorBaseProps,
} from './AssetSelectorContent'
import { AssetSelectorById } from './AssetSelectorById'

export type AssetSelectorProps = AssetSelectorBaseProps &
    (
        | {
              assetId: string
              /** Label shown when the asset has no resolvable unit name. */
              fallbackLabel?: string
          }
        | {
              /** Pre-resolved asset, bypassing `useAssetsQuery`. */
              asset: Optional<DisplayableAsset>
              /** The asset's chain; null draws it as a token. */
              chainId: Nullable<ChainId>
              /** Label shown next to the icon (e.g. token symbol). */
              label: string
              /** Direct logo URL, forwarded to `AssetIcon`. */
              logoUrl?: string
          }
    )

export const AssetSelector = (props: AssetSelectorProps) => {
    if ('assetId' in props) {
        return <AssetSelectorById {...props} />
    }

    return <AssetSelectorContent {...props} />
}
