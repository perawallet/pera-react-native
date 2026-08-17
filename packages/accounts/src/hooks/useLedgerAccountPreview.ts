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
import { Decimal } from 'decimal.js'
import {
    useAssetsQuery,
    useAssetPricesQuery,
    ALGO_ASSET,
    PeraAssetVerificationTier,
} from '@perawallet/wallet-core-assets'
import {
    baseUnitsToDisplayUnits,
    microAlgosToAlgos,
} from '@perawallet/wallet-core-blockchain'
import { ALGO_ASSET_ID, ALGO_ASSET_NAME } from '@perawallet/wallet-core-shared'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import type {
    LedgerAccountPreview,
    LedgerAccountPreviewAsset,
    LedgerAccountRekeyRelationship,
    UseLedgerAccountPreviewResult,
} from '../models'
import { useOnChainAccountInformationQuery } from './useOnChainAccountInformationQuery'
import { useRekeyedAddressesQuery } from './useRekeyedAddressesQuery'

export const useLedgerAccountPreview = (
    address: string,
): UseLedgerAccountPreviewResult => {
    const onChain = useOnChainAccountInformationQuery(address)
    const rekeyed = useRekeyedAddressesQuery(address)
    const { usdToPreferred } = useCurrency()

    const assetIds = useMemo(
        () => (onChain.data?.assets ?? []).map(a => String(a.assetId)),
        [onChain.data],
    )

    const { data: assets } = useAssetsQuery(assetIds)
    const priceIds = useMemo(() => [ALGO_ASSET_ID, ...assetIds], [assetIds])
    const { data: prices } = useAssetPricesQuery(priceIds)

    const preview = useMemo<LedgerAccountPreview | undefined>(() => {
        if (!onChain.data) return undefined

        const algoBalance = microAlgosToAlgos(onChain.data.amount)
        const algoUsdPrice =
            prices?.get(ALGO_ASSET_ID)?.usdPrice ?? new Decimal(0)

        const previewAssets: LedgerAccountPreviewAsset[] = []
        let totalUsd = algoBalance.times(algoUsdPrice)

        previewAssets.push({
            assetId: ALGO_ASSET_ID,
            name: ALGO_ASSET.name ?? 'Algo',
            unitName: ALGO_ASSET.unitName ?? ALGO_ASSET_NAME,
            decimals: ALGO_ASSET.decimals,
            hasKnownDecimals: true,
            amount: algoBalance,
            fiatValue: usdToPreferred(algoBalance.times(algoUsdPrice)),
            usdPrice: algoUsdPrice,
            verificationTier: PeraAssetVerificationTier.verified,
            logo: undefined,
            isAlgo: true,
            isFrozen: false,
        })

        for (const holding of onChain.data.assets) {
            const id = String(holding.assetId)
            const meta = assets?.get(id)
            const hasKnownDecimals = meta?.decimals !== undefined
            const decimals = meta?.decimals ?? 0
            const amount = baseUnitsToDisplayUnits(holding.amount, decimals)
            const usdPrice = prices?.get(id)?.usdPrice ?? new Decimal(0)
            // Without decimals `amount` is raw base units — a price times
            // that is garbage, so the holding contributes no fiat value.
            const usdValue = hasKnownDecimals
                ? amount.times(usdPrice)
                : new Decimal(0)
            totalUsd = totalUsd.plus(usdValue)
            previewAssets.push({
                assetId: id,
                name: meta?.name ?? id,
                unitName: meta?.unitName ?? '',
                decimals,
                hasKnownDecimals,
                amount,
                fiatValue: usdToPreferred(usdValue),
                usdPrice,
                verificationTier:
                    meta?.peraMetadata?.verificationTier ??
                    PeraAssetVerificationTier.unverified,
                logo: meta?.peraMetadata?.logo ?? undefined,
                isAlgo: false,
                isFrozen: holding.isFrozen,
            })
        }

        const authAddress = onChain.data.authAddress
        let rekey: LedgerAccountRekeyRelationship = { kind: 'none' }
        if (authAddress && authAddress !== address) {
            rekey = { kind: 'rekeyedTo', authAddress }
        } else if (
            !rekeyed.isError &&
            rekeyed.rekeyedAddresses &&
            rekeyed.rekeyedAddresses.length > 0
        ) {
            rekey = { kind: 'canSignFor', addresses: rekeyed.rekeyedAddresses }
        }

        return {
            address,
            algoBalance,
            totalFiatValue: usdToPreferred(totalUsd),
            assets: previewAssets,
            rekey,
        }
    }, [
        address,
        onChain.data,
        assets,
        prices,
        rekeyed.rekeyedAddresses,
        rekeyed.isError,
        usdToPreferred,
    ])

    return {
        preview,
        isLoading: onChain.isLoading,
        isError: onChain.isError,
        refetch: () => void onChain.refetch(),
    }
}
