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
    useSingleAssetDetailsQuery,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import type {
    ChainScope,
    SpendApproval,
} from '@perawallet/wallet-core-chain-contract'
import {
    isEvmApprovalCall,
    spendApprovalOfCall,
    toEvmNftAssetId,
    type EthereumTransactionView,
    type EvmNftItem,
    type EvmStandardCall,
} from '@perawallet/wallet-core-chain-ethereum'
import { useChainCapability } from '@perawallet/wallet-core-chain-shared'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { useBaseUnitsAmount } from '@hooks/useBaseUnitsAmount'

export type EthereumAmount = {
    /** Null only when a token's record can't be read; `value` is then in base units. */
    asset: Nullable<PeraAsset>
    /** In display units of `asset`. */
    value: Decimal
}

/** A standard token call as review shows it, once the token says what it is. */
export type EthereumStandardCallPresentation =
    | {
          kind: 'token-transfer'
          contract: string
          from: string
          to: string
          amount: EthereumAmount
      }
    | {
          kind: 'nft-transfer'
          contract: string
          from: string
          to: string
          items: EvmNftItem[]
          collectionName?: string
          /** The first item's record, when the store can read it. */
          asset: Nullable<PeraAsset>
      }
    | {
          kind: 'token-approval'
          contract: string
          spender: string
          /** Absent on a revocation. */
          spendApproval?: SpendApproval
      }
    | {
          kind: 'nft-approval'
          contract: string
          spender: string
          tokenId: string
          collectionName?: string
          isRevocation: boolean
      }
    | {
          kind: 'collection-approval'
          contract: string
          operator: string
          isApproved: boolean
      }

export type UseEthereumStandardCallResult = {
    standardCall: Nullable<EthereumStandardCallPresentation>
    isLoading: boolean
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

// `transfer-from` and `approve` may still turn out to be an NFT's once the
// contract has no fungible record.
const isFungibleCandidate = (call: EvmStandardCall): boolean =>
    call.kind === 'transfer' ||
    call.kind === 'transfer-from' ||
    call.kind === 'approve' ||
    call.kind === 'increase-allowance'

const valueOf = (call: EvmStandardCall): Optional<Decimal> =>
    'value' in call ? call.value : undefined

const nftAssetIdOf = (
    call: EvmStandardCall,
    hasFungibleRecord: boolean,
    isFungibleSettled: boolean,
): string => {
    switch (call.kind) {
        case 'erc721-safe-transfer': {
            return toEvmNftAssetId(call.contract, call.tokenId)
        }
        case 'erc1155-transfer': {
            return toEvmNftAssetId(call.contract, call.items[0].tokenId)
        }
        case 'transfer-from':
        case 'approve': {
            return isFungibleSettled && !hasFungibleRecord
                ? toEvmNftAssetId(call.contract, call.value.toFixed())
                : ''
        }
        default: {
            return ''
        }
    }
}

const collectionNameOf = (asset: Nullable<PeraAsset>): Optional<string> =>
    asset?.peraMetadata?.collectible?.collection?.name

// Granting nothing still reads as a grant: a zero `approve` on an ERC-721
// approves token #0, and a zero `increaseAllowance` leaves the allowance as it was.
const zeroGrantOf = (
    call: Extract<EvmStandardCall, { kind: 'approve' | 'increase-allowance' }>,
    chainId: ChainScope['chainId'],
): SpendApproval => ({
    spender: call.spender,
    allowances: [
        {
            assetRef: { chainId, assetId: call.contract },
            amount: new Decimal(0),
        },
    ],
    isLongLived: true,
})

const present = (
    call: EvmStandardCall,
    chainId: ChainScope['chainId'],
    token: EthereumAmount,
    nft: Nullable<PeraAsset>,
): EthereumStandardCallPresentation => {
    switch (call.kind) {
        case 'transfer':
        case 'transfer-from': {
            if (call.kind === 'transfer-from' && nft) {
                return {
                    kind: 'nft-transfer',
                    contract: call.contract,
                    from: call.from,
                    to: call.to,
                    items: [
                        {
                            tokenId: call.value.toFixed(),
                            amount: new Decimal(1),
                        },
                    ],
                    collectionName: collectionNameOf(nft),
                    asset: nft,
                }
            }
            return {
                kind: 'token-transfer',
                contract: call.contract,
                from: call.from,
                to: call.to,
                amount: token,
            }
        }
        case 'erc721-safe-transfer':
        case 'erc1155-transfer': {
            return {
                kind: 'nft-transfer',
                contract: call.contract,
                from: call.from,
                to: call.to,
                items:
                    call.kind === 'erc1155-transfer'
                        ? call.items
                        : [{ tokenId: call.tokenId, amount: new Decimal(1) }],
                collectionName: collectionNameOf(nft),
                asset: nft,
            }
        }
        case 'approve': {
            if (nft) {
                return {
                    kind: 'nft-approval',
                    contract: call.contract,
                    spender: call.spender,
                    tokenId: call.value.toFixed(),
                    collectionName: collectionNameOf(nft),
                    isRevocation: call.spender.toLowerCase() === ZERO_ADDRESS,
                }
            }
            // Only a fungible token's zero approve is known to revoke.
            const isRevocation = call.value.isZero() && !!token.asset
            return {
                kind: 'token-approval',
                contract: call.contract,
                spender: call.spender,
                ...(!isRevocation && {
                    spendApproval:
                        spendApprovalOfCall(call, chainId) ??
                        zeroGrantOf(call, chainId),
                }),
            }
        }
        case 'increase-allowance': {
            return {
                kind: 'token-approval',
                contract: call.contract,
                spender: call.spender,
                spendApproval:
                    spendApprovalOfCall(call, chainId) ??
                    zeroGrantOf(call, chainId),
            }
        }
        case 'set-approval-for-all': {
            return {
                kind: 'collection-approval',
                contract: call.contract,
                operator: call.operator,
                isApproved: call.isApproved,
            }
        }
    }
}

/**
 * Reads an approval always and a transfer only while `contractDecoding` is on,
 * as the reviewer gates a dApp's call.
 * The calldata can't say whether `approve` or `transferFrom` moves an amount
 * or a token id, so the token's own records decide: a fungible record first,
 * then an NFT record for that id, and neither means an unknown token shown in
 * base units.
 */
export const useEthereumStandardCall = (
    view: Nullable<EthereumTransactionView>,
    scope: ChainScope,
): UseEthereumStandardCallResult => {
    const isDecoding = useChainCapability(scope.chainId, 'contractDecoding')
    const call =
        view?.call && (isDecoding || isEvmApprovalCall(view.call))
            ? view.call
            : undefined

    const fungible = useBaseUnitsAmount(
        call && isFungibleCandidate(call) ? call.contract : '',
        call ? valueOf(call) : undefined,
        scope,
    )
    const nftAssetId = call
        ? nftAssetIdOf(call, !!fungible.asset, !fungible.isLoading)
        : ''
    const { data: nftData, isPending: isNftPending } =
        useSingleAssetDetailsQuery(nftAssetId, scope)
    // A disabled query reports pending too.
    const isNftLoading = !!nftAssetId && isNftPending

    return useMemo(() => {
        if (!call) return { standardCall: null, isLoading: false }
        const raw = valueOf(call)
        const token: EthereumAmount = {
            asset: fungible.asset,
            value: fungible.value ?? raw ?? new Decimal(0),
        }
        const nft = nftAssetId ? (nftData ?? null) : null
        return {
            standardCall: present(call, scope.chainId, token, nft),
            isLoading: fungible.isLoading || isNftLoading,
        }
    }, [
        call,
        scope.chainId,
        fungible.asset,
        fungible.value,
        fungible.isLoading,
        nftAssetId,
        nftData,
        isNftLoading,
    ])
}
