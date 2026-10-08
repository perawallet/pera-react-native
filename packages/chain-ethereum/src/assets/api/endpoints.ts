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
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import { queryClient } from '@perawallet/wallet-core-shared'
import {
    eip155ChainIdOf,
    fromCaip19,
    InvalidCaip19Error,
    toCaip19,
} from '../../blockchain/utils/caip19'
import {
    assetsResponseSchema,
    whitelistItemSchema,
    whitelistResponseSchema,
    type AssetItemSchemaOutput,
} from './schema'

export const ASSETS_SERVICE = 'assets'

export const ASSETS_PATH = '/api/v4/assets/'
export const whitelistPath = (eip155ChainId: number | string): string =>
    `/api/v3/evm/${eip155ChainId}/tokens/`

/**
 * `asset` is null when the backend has no metadata for the token: it does not
 * know it, or it quarantined it (`isQuarantined`).
 */
export type AssetItem = {
    assetId: string
    asset: PeraAsset | null
    isQuarantined: boolean
}

export type WhitelistRow = {
    /** App asset id: the native id or a checksummed contract address. */
    assetId: string
    type: 'native' | 'erc20'
}

// isFavorited and isPriceAlertEnabled stay unset: the persisted row keeps the
// user's own flags only when the incoming ones are absent.
const toPeraAsset = (
    assetId: string,
    item: AssetItemSchemaOutput,
): PeraAsset | null =>
    item.fraction_decimals === null
        ? null
        : {
              assetId,
              name: item.name ?? undefined,
              unitName: item.unit_name ?? undefined,
              decimals: item.fraction_decimals,
              // The backend sends no supply: 0 unless the asset came from a
              // chain read.
              totalSupply: new Decimal(0),
              creator: { address: '' },
              peraMetadata: {
                  isDeleted: false,
                  verificationTier: item.verification_tier,
                  logo: item.logo,
                  type: 'standard_asset',
              },
          }

// The backend withholds a quarantined token's metadata but keeps its tier.
const isQuarantined = (item: AssetItemSchemaOutput): boolean =>
    item.fraction_decimals === null && item.verification_tier === 'suspicious'

/** At most 500 ids per call; answers in request order. Rejects with a `PeraNetworkError` on a failed request. */
export const fetchAssetItems = async (
    scope: ChainScope,
    assetIds: string[],
): Promise<AssetItem[]> => {
    if (assetIds.length === 0) return []
    const ids = assetIds.map(id => toCaip19(id, scope))
    const { data } = await queryClient<unknown>({
        backend: 'pera',
        service: ASSETS_SERVICE,
        scope,
        method: 'POST',
        url: ASSETS_PATH,
        data: { ids },
    })
    const { results } = assetsResponseSchema.parse(data)
    // Items carry no key of their own beyond position, so a misaligned answer
    // would cache one token's decimals under another's id.
    if (
        results.length !== ids.length ||
        results.some(
            (item, index) => item.asset_id.toLowerCase() !== ids[index],
        )
    ) {
        throw new Error(
            `Pera assets for ${scope.chainId}/${scope.networkId} answered out of request order`,
        )
    }
    return results.map((item, index) => ({
        assetId: assetIds[index]!,
        asset: toPeraAsset(assetIds[index]!, item),
        isQuarantined: isQuarantined(item),
    }))
}

const toWhitelistRow = (
    row: unknown,
    scope: ChainScope,
): WhitelistRow | null => {
    const parsed = whitelistItemSchema.safeParse(row)
    if (!parsed.success) return null
    const { type, asset_id } = parsed.data
    if (type !== 'native' && type !== 'erc20') return null
    try {
        return { assetId: fromCaip19(asset_id, scope), type }
    } catch (error) {
        if (error instanceof InvalidCaip19Error) return null
        throw error
    }
}

/**
 * The backend's listed tokens for the scope's chain, native first; rows this
 * client can't use are skipped. Rejects with a `PeraNetworkError` on a failed
 * request.
 */
export const fetchWhitelist = async (
    scope: ChainScope,
): Promise<WhitelistRow[]> => {
    const { data } = await queryClient<unknown>({
        backend: 'pera',
        service: ASSETS_SERVICE,
        scope,
        method: 'GET',
        url: whitelistPath(eip155ChainIdOf(scope)),
    })
    const { results } = whitelistResponseSchema.parse(data)
    return results.flatMap(row => toWhitelistRow(row, scope) ?? [])
}
