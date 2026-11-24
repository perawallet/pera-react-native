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
import type { TFunction } from 'i18next'
import { useAssetsQuery, type PeraAsset } from '@perawallet/wallet-core-assets'
import {
    addressCodecs,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { useEthereumReviewTitle } from '@modules/ethereum/hooks/useEthereumReviewTitle'
import type { EthereumTransactionPresentation } from '@modules/ethereum/hooks/useEthereumTransactionPresentation'
import {
    approvedContractOf,
    ethereumPermissionsOf,
    grantLabelOf,
    permissionSymbolOf,
    type EthereumPermission,
} from '@modules/ethereum/components/EthereumTransactionReviewBody/ethereumPermissions'

/** What one call of a batch moves or grants, shown on its row so it can't hide behind a verb. */
export type EthereumPreviewDetail =
    /** `value` is in display units of `asset`, or base units when `asset` is null. */
    | { kind: 'amount'; asset: Nullable<PeraAsset>; value: Decimal }
    | { kind: 'label'; label: string; isWarning: boolean }

export type UseEthereumTransactionPreviewResult = {
    title: string
    detail: Nullable<EthereumPreviewDetail>
}

// Rows never simulate: a batch's later calls can't be, so every row reads its calldata alike.
const NOT_SIMULATED = { status: 'hidden' } as const

const shortAddressOf = (scope: ChainScope, address: string): string =>
    addressCodecs.has(scope.chainId)
        ? addressCodecs.get(scope.chainId).truncate(address)
        : address

const permissionDetailOf = (
    permission: EthereumPermission,
    shortAddress: (address: string) => string,
    t: TFunction,
): Nullable<EthereumPreviewDetail> => {
    const { grant } = permission
    switch (grant.kind) {
        case 'revoke': {
            return null
        }
        case 'amount': {
            return {
                kind: 'amount',
                asset: grant.isBaseUnits ? null : permission.asset,
                value: grant.amount,
            }
        }
        default: {
            return {
                kind: 'label',
                label: grantLabelOf(
                    permission,
                    permissionSymbolOf(permission, shortAddress),
                    t,
                ),
                isWarning: grant.kind === 'unlimited',
            }
        }
    }
}

const transferDetailOf = (
    presentation: EthereumTransactionPresentation,
    shortAddress: (address: string) => string,
    t: TFunction,
): Nullable<EthereumPreviewDetail> => {
    const { collectible, amount, view, standardCall } = presentation
    if (collectible) {
        const contract =
            view.nft?.contract ??
            (standardCall?.kind === 'nft-transfer'
                ? standardCall.contract
                : undefined)
        const collection =
            collectible.collectionName ??
            amount?.asset?.unitName ??
            (contract ? shortAddress(contract) : '')
        return {
            kind: 'label',
            label: t('transactions.list_item.nft_subtitle', {
                collection,
                tokenId: collectible.tokenId,
            }),
            isWarning: false,
        }
    }
    return amount
        ? { kind: 'amount', asset: amount.asset, value: amount.value }
        : null
}

export const useEthereumTransactionPreview = (
    presentation: EthereumTransactionPresentation,
): UseEthereumTransactionPreviewResult => {
    const { t } = useLanguage()
    const title = useEthereumReviewTitle(presentation)
    const { scope } = presentation
    const approvedContract = approvedContractOf(presentation)
    const { data: tokenAssets } = useAssetsQuery(
        scope,
        approvedContract ? [approvedContract] : [],
        { fetchMissing: true },
    )
    const tokenAsset = approvedContract
        ? (tokenAssets.get(approvedContract) ?? null)
        : null

    const detail = useMemo((): Nullable<EthereumPreviewDetail> => {
        const shortAddress = (address: string) => shortAddressOf(scope, address)
        const [permission] = ethereumPermissionsOf(
            presentation,
            NOT_SIMULATED,
            tokenAsset,
        )
        if (permission) return permissionDetailOf(permission, shortAddress, t)
        if (presentation.isTransfer) {
            return transferDetailOf(presentation, shortAddress, t)
        }
        const { value } = presentation
        return value.value.greaterThan(0)
            ? { kind: 'amount', asset: value.asset, value: value.value }
            : null
    }, [presentation, scope, tokenAsset, t])

    return { title, detail }
}
