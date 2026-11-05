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

import { useCallback, useMemo } from 'react'
import { useCollectibleMetadataQuery } from '@perawallet/wallet-core-assets'
import type { TransactionRecord } from '@perawallet/wallet-core-chain-contract'
import {
    EVM_NFT_STANDARD_LABELS,
    parseEvmNftAssetId,
    readEvmRecordNft,
} from '@perawallet/wallet-core-chain-ethereum'
import {
    formatNumber,
    truncateAlgorandAddress,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useCapability } from '@hooks/useCapability'
import { useLanguage } from '@hooks/useLanguage'

export type EthereumRecordNft = {
    assetId: string
    contract: string
    /** Decimal digits, which can run to 78 of them. */
    tokenId: string
    /** A whole number with no symbol: an NFT has no decimals. */
    quantity: string
    title: string
    /** The collection and standard, under the NFT's own name; unset when no name is known. */
    subtitle?: string
    thumbnailUrl?: string
}

export type UseEthereumRecordNftResult = {
    /** Unset unless the record moves a single NFT. */
    nft: Optional<EthereumRecordNft>
    /** Unset without metadata, since the detail screen has nothing else to show, or while the chain's NFTs are off. */
    handleOpen: Optional<() => void>
}

/**
 * The metadata is the NFTs tab's: the Pera NFT service, never the node, so a
 * page that makes no node read of its own still makes none. An NFT the service
 * doesn't know reads by its collection and token id.
 */
export const useEthereumRecordNft = (
    record: TransactionRecord,
): UseEthereumRecordNftResult => {
    const { t } = useLanguage()
    const navigation = useAppNavigation()
    const { scope, summary } = record
    const facts = readEvmRecordNft(record)
    const assetId =
        facts && summary.kind === 'nft-transfer' && summary.amount
            ? summary.amount.assetRef.assetId
            : undefined
    const parsed = useMemo(
        () => (assetId ? parseEvmNftAssetId(assetId) : null),
        [assetId],
    )
    const { data: asset } = useCollectibleMetadataQuery(
        parsed && assetId ? assetId : '',
        scope,
    )
    const hasNfts = useCapability({
        chain: { chainId: scope.chainId, capability: 'nft' },
    })

    const nft = useMemo((): Optional<EthereumRecordNft> => {
        if (!facts || !assetId || !parsed || !summary.amount) return undefined
        const collectible = asset?.peraMetadata?.collectible
        const name = collectible?.title ?? asset?.name
        const collection =
            collectible?.collection?.name ??
            facts.collectionName ??
            truncateAlgorandAddress(parsed.contract)
        const base = {
            assetId,
            contract: parsed.contract,
            tokenId: parsed.tokenId,
            quantity: formatNumber(summary.amount.value, 0).integer,
        }
        if (!name) {
            return {
                ...base,
                title: t('transactions.record_detail.nft_fallback', {
                    collection,
                    tokenId: truncateAlgorandAddress(parsed.tokenId),
                }),
            }
        }
        return {
            ...base,
            title: name,
            subtitle: t('transactions.record_detail.nft_collection', {
                collection,
                standard: EVM_NFT_STANDARD_LABELS[facts.standard],
            }),
            thumbnailUrl:
                collectible?.primaryImage ??
                asset?.peraMetadata?.logo ??
                undefined,
        }
    }, [facts, assetId, parsed, summary.amount, asset, t])

    const handleOpen = useCallback(() => {
        if (!assetId) return
        navigation.navigate('TabBar', {
            screen: 'Home',
            params: {
                screen: 'CollectibleDetails',
                params: { assetId, chainId: scope.chainId },
            },
        })
    }, [navigation, assetId, scope.chainId])

    return {
        nft,
        handleOpen: nft && asset && hasNfts ? handleOpen : undefined,
    }
}
