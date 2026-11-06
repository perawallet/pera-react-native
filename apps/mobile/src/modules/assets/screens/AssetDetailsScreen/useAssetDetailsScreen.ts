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

import { useCallback, useEffect, useMemo } from 'react'
import {
    addressOn,
    canHideHolding,
    hiddenAssetIdsOf,
    useAccountAssetBalanceQuery,
    useAccountHoldingSources,
    useHiddenTokensStore,
    useSelectedAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    isCollectible as isCollectibleAsset,
    useAssetOnChainSupplyQuery,
    useSingleAssetDetailsQuery,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import {
    isNativeAsset,
    type ChainId,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    getChainDescriptor,
    useChainCapability,
    useSelectedScope,
} from '@perawallet/wallet-core-chain-shared'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { trackEvent, AssetDetailsEvent, AnalyticsMetadataKey } from '@analytics'
import type { PWDropdownItem } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { chainUiFor } from '@modules/chain-ui'
import { nativeAssetInfoOf } from '@modules/chain-ui/icon'
import type {
    AssetAboutDisplay,
    AssetDetailsDisplay,
    AssetDisplayParams,
    AssetSupplyDisplay,
} from '../../types/asset-details-display'
import { neutralAssetDetailsDisplay } from './neutralAssetDetailsDisplay'

export type UseAssetDetailsScreenParams = {
    assetId: string
    chainId: ChainId
    isCollectible: boolean
}

export type UseAssetDetailsScreenResult = {
    account: Nullable<WalletAccount>
    asset: Optional<PeraAsset>
    scope: ChainScope
    isLoading: boolean
    isError: boolean
    /** The symbol of what was opened (`ALGO`, `USDC`); empty until the asset loads. */
    headerTitle: string
    assetDetailsDisplay: AssetDetailsDisplay
    about: Nullable<AssetAboutDisplay>
    supply: Nullable<AssetSupplyDisplay>
    isNetworkLineVisible: boolean
    isMarketsTabVisible: boolean
    /** Hide or unhide, for a token the account holds on a chain that receives unasked assets; empty otherwise. */
    headerMenuItems: PWDropdownItem[]
}

export const useAssetDetailsScreen = ({
    assetId,
    chainId,
    isCollectible,
}: UseAssetDetailsScreenParams): UseAssetDetailsScreenResult => {
    const account = useSelectedAccount()
    const scope = useSelectedScope(chainId)
    const {
        data: asset,
        isPending,
        isError: isQueryError,
    } = useSingleAssetDetailsQuery(assetId, scope)
    // A failed background refetch keeps the loaded asset; only a load that never produced one is an error.
    const isError = isQueryError && !asset
    const descriptor = getChainDescriptor(chainId)
    const assetDetailsDisplay =
        chainUiFor(descriptor.family, chainId).assetDetails ??
        neutralAssetDetailsDisplay

    const isNative = isNativeAsset({ chainId, assetId }, descriptor)
    // Sync stores a zero supply for a token whose source carried none; one
    // chain read for the asset on screen fills it. A collectible stores zero
    // too, and a chain can't read it as a token.
    const { totalSupply: onChainSupply } = useAssetOnChainSupplyQuery(
        assetId,
        scope,
        !!asset &&
            !isNative &&
            !isCollectible &&
            !isCollectibleAsset(asset) &&
            asset.totalSupply.isZero(),
    )

    const { about, supply } = useMemo(() => {
        if (!asset) {
            return { about: null, supply: null }
        }
        const params: AssetDisplayParams = {
            asset,
            scope,
            descriptor,
            isNativeAsset: isNative,
        }
        return {
            about: assetDetailsDisplay.resolveAbout(params),
            supply: assetDetailsDisplay.resolveSupply(
                onChainSupply
                    ? {
                          ...params,
                          asset: { ...asset, totalSupply: onChainSupply },
                      }
                    : params,
            ),
        }
    }, [asset, assetDetailsDisplay, scope, descriptor, isNative, onChainSupply])

    // The same test Home uses for its chain badges, so both screens agree on when a chain needs naming.
    const isNetworkLineVisible = useAccountHoldingSources(account).length > 1
    // Market data comes from the chain's pricing; without it the tab would only ever be empty.
    const isMarketsTabVisible = useChainCapability(chainId, 'pricing')

    // Screen-view tracking (screen_asset_detail) is centralized in the
    // navigator's screenListeners (see routes/listeners.ts). This effect only
    // fires the asset-specific "Show" event, which carries the asset id.
    useEffect(() => {
        if (assetId && !isCollectible) {
            trackEvent(AssetDetailsEvent.Show, {
                [AnalyticsMetadataKey.AssetId]: assetId,
                [AnalyticsMetadataKey.ChainId]: chainId,
            })
        }
    }, [assetId, chainId, isCollectible])

    const { t } = useLanguage()
    const { showToast } = useToast()
    const address = account ? addressOn(account, scope) : undefined
    const { data: holding } = useAccountAssetBalanceQuery(
        account ?? undefined,
        assetId,
        scope,
    )
    const isHidden = useHiddenTokensStore(
        state =>
            address !== undefined &&
            hiddenAssetIdsOf(state.hiddenTokens, address, scope).includes(
                assetId,
            ),
    )
    const setTokenHidden = useHiddenTokensStore(state => state.setTokenHidden)
    // The route flag is missing for an NFT opened from a chain without the nft
    // capability, so the asset's own type decides too.
    const canHide =
        !isCollectible &&
        !(asset && isCollectibleAsset(asset)) &&
        canHideHolding(chainId, assetId) &&
        address !== undefined &&
        holding !== null
    const assetName = asset?.name || asset?.unitName || ''

    const handleToggleHidden = useCallback(() => {
        if (address === undefined) return
        setTokenHidden({ address, scope, assetId, isHidden: !isHidden })
        showToast(
            isHidden
                ? {
                      title: t('token_visibility.shown_toast_title', {
                          assetName,
                      }),
                      body: '',
                      type: 'success',
                  }
                : {
                      title: t('token_visibility.hidden_toast_title', {
                          assetName,
                      }),
                      body: t('token_visibility.hidden_toast_body'),
                      type: 'success',
                  },
        )
    }, [
        address,
        scope,
        assetId,
        isHidden,
        assetName,
        setTokenHidden,
        showToast,
        t,
    ])

    const headerMenuItems = useMemo<PWDropdownItem[]>(
        () =>
            canHide
                ? [
                      {
                          label: t(
                              isHidden
                                  ? 'token_visibility.unhide'
                                  : 'token_visibility.hide',
                          ),
                          icon: 'eye',
                          onPress: handleToggleHidden,
                      },
                  ]
                : [],
        [canHide, isHidden, handleToggleHidden, t],
    )

    const headerTitle = asset
        ? (nativeAssetInfoOf({ chainId, assetId })?.symbol ??
          (asset.unitName || asset.name || ''))
        : ''

    return {
        account,
        asset,
        scope,
        isLoading: !isError && (isPending || !asset || !account),
        isError,
        headerTitle,
        assetDetailsDisplay,
        about,
        supply,
        isNetworkLineVisible,
        isMarketsTabVisible,
        headerMenuItems,
    }
}
