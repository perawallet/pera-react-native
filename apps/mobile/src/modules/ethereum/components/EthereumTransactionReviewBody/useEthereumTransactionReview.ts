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
    useAssetPricesQuery,
    useAssetsQuery,
    type DisplayableAsset,
} from '@perawallet/wallet-core-assets'
import {
    addressCodecs,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import type { SignRequestSource } from '@perawallet/wallet-core-signing'
import { useLanguage } from '@hooks/useLanguage'
import {
    type BalanceImpactItem,
    type ReviewTargetStatus,
    type ReviewWarningItem,
} from '@modules/signing'
import type { EthereumTransactionPresentation } from '../../hooks/useEthereumTransactionPresentation'
import { useEthereumReviewTitle } from '../../hooks/useEthereumReviewTitle'
import { requesterHostOf } from '../../utils/contractCallNotice'
import {
    useEthereumSimulationSection,
    type EthereumSimulationSectionState,
} from '../EthereumSimulationSection'
import {
    approvedContractOf,
    ethereumPermissionsOf,
    type EthereumPermission,
} from './ethereumPermissions'
import {
    ethereumActionAssetIdsOf,
    ethereumActionChangesOf,
    type EthereumActionChanges,
} from './ethereumActionChanges'
import { ethereumReviewWarningsOf } from './ethereumReviewWarnings'
import { ethereumReviewWarningItemOf } from './ethereumReviewWarningItemOf'

type UseEthereumTransactionReviewParams = {
    presentation: EthereumTransactionPresentation
    source?: SignRequestSource
    verifiedOrigin?: string
}

export type EthereumReviewTarget = {
    label: string
    status?: ReviewTargetStatus
}

export type UseEthereumTransactionReviewResult = {
    simulation: EthereumSimulationSectionState
    warningItems: ReviewWarningItem[]
    /** The action's verb, or a verified call's function name. */
    title: string
    target: Optional<EthereumReviewTarget>
    permissions: EthereumPermission[]
    /** What a transfer sends, for a review the simulation doesn't cover. */
    transferSpend: BalanceImpactItem[]
    /** What a decoded call's calldata fixes it moves, for a review the simulation doesn't cover. */
    actionChanges: EthereumActionChanges
    /** The site the request came from, as the platform observed it. */
    requesterHost: Optional<string>
}

const shortAddressOf = (scope: ChainScope, address: string): string =>
    addressCodecs.has(scope.chainId)
        ? addressCodecs.get(scope.chainId).truncate(address)
        : address

export const useEthereumTransactionReview = ({
    presentation,
    source,
    verifiedOrigin,
}: UseEthereumTransactionReviewParams): UseEthereumTransactionReviewResult => {
    const { t } = useLanguage()
    const simulation = useEthereumSimulationSection(presentation)
    const {
        scope,
        view,
        standardCall,
        contractAction,
        knownContract,
        isTransfer,
        counterparty,
        amount,
        collectible,
        nftItems,
    } = presentation
    const approvedContract = approvedContractOf(presentation)
    const title = useEthereumReviewTitle(presentation)
    const wrappedNativeContract =
        (contractAction?.kind === 'wrap' ||
            contractAction?.kind === 'unwrap') &&
        view.to
            ? view.to
            : undefined
    const recordIds = [approvedContract, wrappedNativeContract].filter(
        (id): id is string => !!id,
    )
    const { data: tokenAssets } = useAssetsQuery(scope, recordIds, {
        fetchMissing: true,
    })
    const tokenAsset = approvedContract
        ? (tokenAssets.get(approvedContract) ?? null)
        : null
    const wrappedNativeRecord = wrappedNativeContract
        ? (tokenAssets.get(wrappedNativeContract) ?? null)
        : null
    const nativeAsset =
        contractAction?.kind === 'wrap' || contractAction?.kind === 'unwrap'
            ? contractAction.amount.asset
            : null
    const wrappedNative = useMemo((): Nullable<DisplayableAsset> => {
        if (wrappedNativeRecord || !wrappedNativeContract || !nativeAsset) {
            return wrappedNativeRecord
        }
        // Without its record, the 1:1 pair still shares the native decimals.
        const label = shortAddressOf(scope, wrappedNativeContract)
        return {
            assetId: wrappedNativeContract,
            name: label,
            unitName: label,
            decimals: nativeAsset.decimals,
        }
    }, [wrappedNativeRecord, wrappedNativeContract, nativeAsset, scope])
    const actionAssetIds = ethereumActionAssetIdsOf(
        contractAction,
        wrappedNative,
    )
    const { data: actionPrices } = useAssetPricesQuery(
        scope,
        actionAssetIds,
        actionAssetIds.length > 0,
        { fetchMissing: true },
    )
    const isReverted = simulation.status === 'reverted'
    const actionChanges = useMemo(
        () =>
            ethereumActionChangesOf(
                // A call predicted to fail moves nothing but gas.
                isReverted ? null : contractAction,
                wrappedNative,
                scope.chainId,
                assetId => actionPrices.get(assetId)?.usdPrice,
            ),
        [
            isReverted,
            contractAction,
            wrappedNative,
            scope.chainId,
            actionPrices,
        ],
    )

    const warningItems = useMemo(
        () =>
            ethereumReviewWarningsOf({
                presentation,
                simulation,
                source,
                verifiedOrigin,
            }).map(warning => ethereumReviewWarningItemOf(warning, scope, t)),
        [presentation, simulation, source, verifiedOrigin, scope, t],
    )

    const target = useMemo((): Optional<EthereumReviewTarget> => {
        if (isTransfer) {
            return counterparty
                ? { label: shortAddressOf(scope, counterparty) }
                : undefined
        }
        if (approvedContract) {
            return {
                label: tokenAsset?.unitName
                    ? t('signing.review.token_contract', {
                          symbol: tokenAsset.unitName,
                      })
                    : shortAddressOf(scope, approvedContract),
            }
        }
        if (knownContract) {
            return { label: knownContract.name, status: 'verified' }
        }
        return view.to
            ? { label: shortAddressOf(scope, view.to), status: 'unverified' }
            : undefined
    }, [
        isTransfer,
        counterparty,
        approvedContract,
        tokenAsset,
        knownContract,
        view.to,
        scope,
        t,
    ])

    const permissions = useMemo(
        () => ethereumPermissionsOf(presentation, simulation, tokenAsset),
        [presentation, simulation, tokenAsset],
    )

    const transferSpend = useMemo((): BalanceImpactItem[] => {
        if (!isTransfer) return []
        const nftContract =
            view.nft?.contract ??
            (standardCall?.kind === 'nft-transfer'
                ? standardCall.contract
                : undefined)
        if (nftContract && (nftItems?.length || collectible)) {
            const record =
                amount?.asset ??
                (standardCall?.kind === 'nft-transfer'
                    ? standardCall.asset
                    : null)
            const collection =
                collectible?.collectionName ??
                (standardCall?.kind === 'nft-transfer'
                    ? standardCall.collectionName
                    : undefined) ??
                record?.unitName ??
                shortAddressOf(scope, nftContract)
            const asset: DisplayableAsset = record ?? {
                assetId: nftContract,
                name: collection,
                unitName: collection,
                decimals: 0,
            }
            const items =
                nftItems ??
                (collectible
                    ? [
                          {
                              tokenId: collectible.tokenId,
                              amount: amount?.value ?? new Decimal(1),
                          },
                      ]
                    : [])
            return items.map((item, index) => ({
                // ERC-1155 lets a batch name the same id twice.
                assetId: `${nftContract}:${item.tokenId}:${index}`,
                chainId: scope.chainId,
                asset,
                isCollectible: true,
                isPureCollectible: false,
                direction: 'spend',
                amount: item.amount,
                isFullBalance: false,
                isNewAsset: false,
                collectibleTitle: t('transactions.list_item.nft_subtitle', {
                    collection,
                    tokenId: item.tokenId,
                }),
            }))
        }
        if (!amount?.asset) return []
        return [
            {
                assetId: amount.asset.assetId,
                chainId: scope.chainId,
                asset: amount.asset,
                isCollectible: false,
                isPureCollectible: false,
                direction: 'spend',
                amount: amount.value,
                isFullBalance: false,
                isNewAsset: false,
            },
        ]
    }, [
        isTransfer,
        view.nft?.contract,
        standardCall,
        nftItems,
        collectible,
        amount,
        scope,
        t,
    ])

    return {
        simulation,
        warningItems,
        title,
        target,
        permissions,
        transferSpend,
        actionChanges,
        requesterHost: requesterHostOf(source, verifiedOrigin),
    }
}
