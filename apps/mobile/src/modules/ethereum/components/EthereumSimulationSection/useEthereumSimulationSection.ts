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
    useAssetPricesQuery,
    useAssetsQuery,
    useNativeAsset,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import {
    simulationRequestOf,
    useEvmTransactionSimulationQuery,
    type EvmApprovalChange,
} from '@perawallet/wallet-core-chain-ethereum'
import { useChainCapability } from '@perawallet/wallet-core-chain-shared'
import {
    baseUnitsToDisplayUnits,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import {
    isExternalCallbackSource,
    useSigningRequest,
} from '@perawallet/wallet-core-signing'
import { balanceImpactItemOf, type BalanceImpactItem } from '@modules/signing'
import type { EthereumStandardCallPresentation } from '../../hooks/useEthereumStandardCall'
import type { EthereumTransactionPresentation } from '../../hooks/useEthereumTransactionPresentation'
import { isCallUnexplained } from '../EthereumContractCallDetails'

export type EthereumApprovalGrant =
    | { kind: 'unlimited' }
    /** `amount` is in display units of the token, or raw base units when `isBaseUnits`. */
    | { kind: 'amount'; amount: Decimal; isBaseUnits: boolean }
    /** One NFT. */
    | { kind: 'token'; tokenId: string }
    | { kind: 'revoke' }

export type EthereumApprovalChangePresentation = {
    key: string
    contract: string
    spender: string
    /** Set when the spender is in the well-known contract registry. */
    spenderName?: string
    /** The token a fungible approval covers; null for an NFT or while its record is unread. */
    asset: Nullable<PeraAsset>
    isCollectionWide: boolean
    grant: EthereumApprovalGrant
}

export type EthereumSimulationSectionState =
    | { status: 'hidden' }
    | { status: 'loading' }
    | {
          status: 'success'
          spend: BalanceImpactItem[]
          receive: BalanceImpactItem[]
          approvals: EthereumApprovalChangePresentation[]
      }
    | { status: 'reverted'; reason: Nullable<string> }
    | { status: 'unavailable' }

const HIDDEN: EthereumSimulationSectionState = { status: 'hidden' }
const LOADING: EthereumSimulationSectionState = { status: 'loading' }
const NO_IDS: string[] = []

const grantOf = (
    change: EvmApprovalChange,
    asset: Nullable<PeraAsset>,
): EthereumApprovalGrant => {
    if (change.amount?.isZero()) return { kind: 'revoke' }
    if (change.isCollectionWide) return { kind: 'unlimited' }
    if (change.tokenId !== undefined) {
        return { kind: 'token', tokenId: change.tokenId }
    }
    if (!change.amount) return { kind: 'unlimited' }
    return {
        kind: 'amount',
        amount: asset
            ? baseUnitsToDisplayUnits(change.amount, asset.decimals)
            : change.amount,
        isBaseUnits: !asset,
    }
}

const sameAddress = (a: string, b: string): boolean =>
    a.toLowerCase() === b.toLowerCase()

// The approval the call's own review already shows from its calldata.
const isDecodedApproval = (
    change: EvmApprovalChange,
    call: Nullable<EthereumStandardCallPresentation>,
): boolean => {
    switch (call?.kind) {
        case 'token-approval': {
            return (
                !change.isCollectionWide &&
                change.tokenId === undefined &&
                sameAddress(change.contract, call.contract) &&
                sameAddress(change.spender, call.spender)
            )
        }
        case 'nft-approval': {
            return (
                !change.isCollectionWide &&
                change.tokenId === call.tokenId &&
                sameAddress(change.contract, call.contract) &&
                sameAddress(change.spender, call.spender)
            )
        }
        case 'collection-approval': {
            return (
                change.isCollectionWide &&
                sameAddress(change.contract, call.contract) &&
                sameAddress(change.spender, call.operator)
            )
        }
        default: {
            return false
        }
    }
}

const approvalOf = (
    change: EvmApprovalChange,
    assets: Map<string, PeraAsset>,
): EthereumApprovalChangePresentation => {
    const isFungible = !change.isCollectionWide && change.tokenId === undefined
    const asset = isFungible ? (assets.get(change.contract) ?? null) : null
    return {
        key: [
            change.contract,
            change.spender,
            change.tokenId ?? '',
            change.isCollectionWide,
        ].join('-'),
        contract: change.contract,
        spender: change.spender,
        ...(change.knownSpender && { spenderName: change.knownSpender.name }),
        asset,
        isCollectionWide: change.isCollectionWide,
        grant: grantOf(change, asset),
    }
}

/**
 * What a dApp call is predicted to do to the signer, once its simulation
 * answers. Nothing here blocks the review: it reads `loading` until the answer
 * and any failure ends as `unavailable`, or `hidden` where the unchecked-call
 * notice already says Pera couldn't check the call. A call whose own gas
 * estimate reverted is `reverted` whatever the view kind or the simulation
 * says: the node has already refused it, so nothing is asked of the backend.
 */
export const useEthereumSimulationSection = (
    presentation: EthereumTransactionPresentation,
): EthereumSimulationSectionState => {
    const { view, scope } = presentation
    const { currentRequest } = useSigningRequest()
    const nativeAsset = useNativeAsset(scope)
    const isDecoding = useChainCapability(scope.chainId, 'contractDecoding')
    const isDappRequest =
        !!currentRequest && isExternalCallbackSource(currentRequest.sourceType)
    const request = useMemo(() => simulationRequestOf(view), [view])
    const revertedEstimate =
        'revertedEstimate' in view ? view.revertedEstimate : undefined
    const isActive =
        isDecoding &&
        isDappRequest &&
        view.kind === 'contract-call' &&
        request !== null &&
        !revertedEstimate

    const {
        data: answer,
        isPending: isSimulationPending,
        isError: isSimulationError,
    } = useEvmTransactionSimulationQuery({
        scope,
        request,
        isEnabled: isActive,
    })
    const success =
        isActive && answer?.status === 'success' ? answer : undefined

    const changedAssetIds = useMemo(
        () => success?.assetChanges.map(change => change.assetId) ?? NO_IDS,
        [success],
    )
    const assetIds = useMemo(() => {
        const approved =
            success?.approvalChanges
                .filter(change => !change.isCollectionWide && !change.tokenId)
                .map(change => change.contract) ?? []
        return [...new Set([...changedAssetIds, ...approved])].filter(
            id => id !== nativeAsset.assetId,
        )
    }, [success, changedAssetIds, nativeAsset.assetId])

    // The tokens in a swap are often ones the user doesn't hold, so neither
    // their records nor their prices are stored yet.
    const { data: assets, isPending: isAssetsPending } = useAssetsQuery(
        scope,
        assetIds,
        { fetchMissing: true },
    )
    const { data: prices, isPending: isPricesPending } = useAssetPricesQuery(
        scope,
        changedAssetIds,
        changedAssetIds.length > 0,
        { fetchMissing: true },
    )

    return useMemo(() => {
        if (revertedEstimate) {
            return {
                status: 'reverted',
                reason: revertedEstimate.reason ?? null,
            }
        }
        if (!isActive) return HIDDEN
        if (isSimulationPending) return LOADING
        if (isSimulationError || !answer || answer.status === 'unavailable') {
            return isCallUnexplained(presentation)
                ? HIDDEN
                : { status: 'unavailable' }
        }
        if (answer.status === 'reverted') {
            return { status: 'reverted', reason: answer.revertReason }
        }
        if (isAssetsPending || isPricesPending) return LOADING

        // A zero delta would read as "You send 0": it moves nothing.
        const moved = answer.assetChanges.filter(
            change => !change.amount.isZero(),
        )
        const items = moved.map(change =>
            balanceImpactItemOf({
                assetId: change.assetId,
                chainId: scope.chainId,
                asset:
                    change.assetId === nativeAsset.assetId
                        ? nativeAsset
                        : assets.get(change.assetId),
                baseUnits: change.amount,
                usdPrice: prices.get(change.assetId)?.usdPrice,
            }),
        )
        // The decoded call's own review already shows its approval.
        const undecoded = answer.approvalChanges.filter(
            change => !isDecodedApproval(change, presentation.standardCall),
        )
        const spend = items.filter(item => item.direction === 'spend')
        const receive = items.filter(item => item.direction === 'receive')
        const isOnlyDecodedApproval =
            undecoded.length < answer.approvalChanges.length &&
            spend.length === 0 &&
            receive.length === 0 &&
            undecoded.length === 0
        // Nothing left to add: the section would only say "no changes".
        if (isOnlyDecodedApproval) return HIDDEN
        return {
            status: 'success',
            spend,
            receive,
            approvals: undecoded.map(change => approvalOf(change, assets)),
        }
    }, [
        revertedEstimate,
        isActive,
        isSimulationPending,
        isSimulationError,
        answer,
        presentation,
        isAssetsPending,
        isPricesPending,
        scope.chainId,
        nativeAsset,
        assets,
        prices,
    ])
}
