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

import { useEffect, useMemo } from 'react'
import { Decimal } from 'decimal.js'
import {
    useAssetsQuery,
    useAssetPricesQuery,
    nativeAssetFor,
    PeraAssetVerificationTier,
} from '@perawallet/wallet-core-assets'
import {
    baseUnitsToDisplayUnits,
    type Optional,
} from '@perawallet/wallet-core-shared'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import type {
    LedgerAccountPreview,
    LedgerAccountPreviewAsset,
    LedgerAccountDelegation,
    UseLedgerAccountPreviewResult,
} from '../models'
import { describeHolding } from '../chain-adapter'
import { recordAuthority } from '../store/recordAuthority'
import { useOnChainAccountStateQuery } from './useOnChainAccountStateQuery'
import { useDelegatedAddressesQuery } from './useDelegatedAddressesQuery'

export const useLedgerAccountPreview = (
    address: string,
    scope: ChainScope,
): UseLedgerAccountPreviewResult => {
    const nativeAsset = nativeAssetFor(scope.chainId)
    const onChain = useOnChainAccountStateQuery(address, scope)
    const delegated = useDelegatedAddressesQuery(address, scope)
    const { usdToPreferred } = useCurrency(scope)
    const authorityAddress = onChain.data?.authorityAddress

    // The sheet's synthetic watch row reads its delegation state from the slice.
    useEffect(() => {
        if (authorityAddress && authorityAddress !== address) {
            recordAuthority(scope, address, authorityAddress)
        }
    }, [scope, address, authorityAddress])

    const heldAssets = useMemo(
        () =>
            (onChain.data?.holdings ?? []).filter(
                holding => holding.assetId !== nativeAsset.assetId,
            ),
        [onChain.data, nativeAsset.assetId],
    )
    const assetIds = useMemo(
        () => heldAssets.map(holding => holding.assetId),
        [heldAssets],
    )

    const { data: assets } = useAssetsQuery(scope, assetIds)
    const priceIds = useMemo(
        () => [nativeAsset.assetId, ...assetIds],
        [nativeAsset.assetId, assetIds],
    )
    const { data: prices } = useAssetPricesQuery(scope, priceIds)

    const preview = useMemo<Optional<LedgerAccountPreview>>(() => {
        if (!onChain.data) return undefined

        const nativeBalance = onChain.data.nativeBalance
        const nativeUsdPrice =
            prices?.get(nativeAsset.assetId)?.usdPrice ?? new Decimal(0)

        const previewAssets: LedgerAccountPreviewAsset[] = []
        let totalUsd = nativeBalance.times(nativeUsdPrice)

        previewAssets.push({
            assetId: nativeAsset.assetId,
            name: nativeAsset.name ?? '',
            unitName: nativeAsset.unitName ?? '',
            decimals: nativeAsset.decimals,
            hasKnownDecimals: true,
            amount: nativeBalance,
            fiatValue: usdToPreferred(nativeBalance.times(nativeUsdPrice)),
            usdPrice: nativeUsdPrice,
            verificationTier: PeraAssetVerificationTier.verified,
            logo: undefined,
            isNative: true,
            restriction: null,
        })

        for (const holding of heldAssets) {
            const id = holding.assetId
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
                isNative: false,
                restriction: describeHolding(
                    scope.chainId,
                    holding.native ?? null,
                ).restriction,
            })
        }

        let delegation: LedgerAccountDelegation = { kind: 'none' }
        if (authorityAddress && authorityAddress !== address) {
            delegation = { kind: 'delegatedTo', authorityAddress }
        } else if (
            !delegated.isError &&
            delegated.delegatedAddresses &&
            delegated.delegatedAddresses.length > 0
        ) {
            delegation = {
                kind: 'canSignFor',
                addresses: delegated.delegatedAddresses,
            }
        }

        return {
            address,
            nativeBalance,
            totalFiatValue: usdToPreferred(totalUsd),
            assets: previewAssets,
            delegation,
        }
    }, [
        address,
        scope.chainId,
        nativeAsset,
        authorityAddress,
        onChain.data,
        heldAssets,
        assets,
        prices,
        delegated.delegatedAddresses,
        delegated.isError,
        usdToPreferred,
    ])

    return {
        preview,
        isLoading: onChain.isLoading,
        isError: onChain.isError,
        refetch: () => void onChain.refetch(),
    }
}
