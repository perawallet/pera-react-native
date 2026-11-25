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

import {
    PeraAssetVerificationTier,
    useSingleAssetDetailsQuery,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import {
    addressCodecs,
    i18nKey,
    type ChainScope,
    type I18nKey,
} from '@perawallet/wallet-core-chain-contract'
import { chainDisplayNameOf } from '@perawallet/wallet-core-chain-shared'
import {
    isTransientNetworkError,
    type Optional,
} from '@perawallet/wallet-core-shared'
import type { ConnectionPeer } from '@perawallet/wallet-extension-connections'
import { useLanguage } from '@hooks/useLanguage'
import { getPreferredDappIcon } from '@modules/walletconnect'
import { toPeerDisplayText } from '@utils/peerDisplay'

const TIER_LABEL: Record<PeraAssetVerificationTier, I18nKey> = {
    verified: i18nKey('walletconnect.watch_asset.tier.verified'),
    unverified: i18nKey('walletconnect.watch_asset.tier.unverified'),
    suspicious: i18nKey('walletconnect.watch_asset.tier.suspicious'),
}

export type UseWatchAssetContentParams = {
    scope: ChainScope
    assetId: string
    peer: ConnectionPeer
}

export type UseWatchAssetContentResult = {
    /** The chain's and Pera's reading of the token; never what the dApp supplied. */
    asset: Optional<PeraAsset>
    isLoading: boolean
    /** The contract answered, or the backend did, but not as a token. */
    isUnreadable: boolean
    /** The read never got an answer (node or network down): says nothing about the contract. */
    isNetworkFailure: boolean
    isSuspicious: boolean
    tierLabel: string
    /** The symbol, else the name, else the contract: what the token is called in copy. */
    assetLabel: string
    truncatedContract: string
    chainName: string
    peerName: string
    peerIconUrl: Optional<string>
}

export const useWatchAssetContent = ({
    scope,
    assetId,
    peer,
}: UseWatchAssetContentParams): UseWatchAssetContentResult => {
    const { t } = useLanguage()
    // Not the local database: a token the wallet has not stored is read from the chain.
    const { data, error, isError, isPending } = useSingleAssetDetailsQuery(
        assetId,
        scope,
        false,
    )
    const isNetworkFailure = isError && isTransientNetworkError(error)
    const tier =
        data?.peraMetadata?.verificationTier ??
        PeraAssetVerificationTier.unverified

    return {
        asset: data,
        isLoading: isPending,
        isUnreadable: isError && !isNetworkFailure,
        isNetworkFailure,
        isSuspicious: tier === PeraAssetVerificationTier.suspicious,
        tierLabel: t(TIER_LABEL[tier]),
        assetLabel: data?.unitName ?? data?.name ?? assetId,
        truncatedContract: addressCodecs.get(scope.chainId).truncate(assetId),
        chainName: chainDisplayNameOf(scope.chainId) ?? scope.chainId,
        peerName: toPeerDisplayText(peer.name),
        peerIconUrl: getPreferredDappIcon(peer.icons),
    }
}
