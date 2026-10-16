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
import type { Decimal } from 'decimal.js'
import {
    useSingleAssetDetailsQuery,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    baseUnitsToDisplayUnits,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'

export type UseBaseUnitsAmountResult = {
    /** Null while loading or when the record can't be read. */
    asset: Nullable<PeraAsset>
    /** Display units of `asset`, or base units when `asset` is null; undefined while loading or without `baseUnits`. */
    value: Optional<Decimal>
    isLoading: boolean
}

export const useBaseUnitsAmount = (
    assetId: string,
    baseUnits: Optional<Decimal>,
    scope: ChainScope,
): UseBaseUnitsAmountResult => {
    // An empty id disables the query.
    const { data, isPending } = useSingleAssetDetailsQuery(assetId, scope)
    // A disabled query reports pending too.
    const isLoading = !!assetId && isPending

    return useMemo(() => {
        const asset = data ?? null
        if (isLoading || !baseUnits) {
            return { asset, value: undefined, isLoading }
        }
        return {
            asset,
            value: asset
                ? baseUnitsToDisplayUnits(baseUnits, asset.decimals)
                : baseUnits,
            isLoading,
        }
    }, [data, isLoading, baseUnits])
}
