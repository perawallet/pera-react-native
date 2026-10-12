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

import { Decimal } from 'decimal.js'
import {
    assetRefKey,
    isNativeAsset,
    type AssetPrice,
    type AssetRef,
} from '@perawallet/wallet-core-chain-contract'
import type { Network } from '@perawallet/wallet-core-shared'
import { fetchPublicAssetDetails } from '../assets/api'
import { ALGORAND_CHAIN_ID } from '../chain-id'
import { algorandDescriptor } from '../descriptor'
import { fetchAssetPrices } from './endpoints'

const fetchNativePrice = async (
    ref: AssetRef,
    network: Network,
): Promise<AssetPrice[]> => {
    const details = await fetchPublicAssetDetails(ref.assetId, network)
    return details.usd_value
        ? [{ assetRef: ref, usdPrice: new Decimal(details.usd_value) }]
        : []
}

// The endpoint answers every requested id; `price: null` means "no price
// known", not a transport gap, so it is left out rather than priced 0.
const fetchTokenPrices = async (
    refs: AssetRef[],
    network: Network,
): Promise<AssetPrice[]> => {
    const response = await fetchAssetPrices(
        refs.map(ref => ref.assetId),
        network,
    )
    const refById = new Map(refs.map(ref => [ref.assetId, ref]))
    return response.flatMap(row => {
        const assetRef = refById.get(row.asset_id)
        return assetRef && row.price !== null
            ? [{ assetRef, usdPrice: new Decimal(row.price) }]
            : []
    })
}

export const fetchPeraUsdPrices = async (
    refs: AssetRef[],
    network: Network,
): Promise<AssetPrice[]> => {
    const foreign = refs.find(ref => ref.chainId !== ALGORAND_CHAIN_ID)
    if (foreign)
        throw new Error(`Not an Algorand asset: ${assetRefKey(foreign)}`)

    const native = refs.filter(ref => isNativeAsset(ref, algorandDescriptor))
    const tokens = refs.filter(ref => !isNativeAsset(ref, algorandDescriptor))
    const [nativePrices, tokenPrices] = await Promise.all([
        native.length > 0
            ? fetchNativePrice(native[0], network)
            : Promise.resolve([]),
        tokens.length > 0
            ? fetchTokenPrices(tokens, network)
            : Promise.resolve([]),
    ])
    return [...nativePrices, ...tokenPrices]
}
