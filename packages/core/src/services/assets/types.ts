import type { AccountDetailAssetSerializerResponse } from '@api/index'

export type AssetDetails = AccountDetailAssetSerializerResponse

export const ALGO_ASSET: AssetDetails = {
    asset_id: 0,
    fraction_decimals: 6,
    unit_name: 'ALGO',
    name: 'Algo',
    verification_tier: 'verified',
    collectible: null,
    last_24_hours_algo_price_change_percentage: 0,
}
