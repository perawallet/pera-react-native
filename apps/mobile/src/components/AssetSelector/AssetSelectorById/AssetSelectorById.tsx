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
import { useAssetsQuery } from '@perawallet/wallet-core-assets'
import {
    AssetSelectorContent,
    type AssetSelectorBaseProps,
} from '../AssetSelectorContent'
import { useHomeChainScope } from '@hooks/useHomeChainScope'

export type AssetSelectorByIdProps = AssetSelectorBaseProps & {
    assetId: string
    fallbackLabel?: string
}

export const AssetSelectorById = ({
    assetId,
    fallbackLabel,
    ...rest
}: AssetSelectorByIdProps) => {
    const scope = useHomeChainScope()
    // The selected asset is often one the account doesn't hold (e.g. the
    // default swap receive asset), so it may not be in the local DB yet.
    const { data: assets } = useAssetsQuery(scope, [assetId], {
        fetchMissing: true,
    })
    const asset = useMemo(() => assets?.get(assetId), [assets, assetId])

    return (
        <AssetSelectorContent
            {...rest}
            asset={asset}
            chainId={scope.chainId}
            label={asset?.unitName ?? fallbackLabel ?? ''}
        />
    )
}
