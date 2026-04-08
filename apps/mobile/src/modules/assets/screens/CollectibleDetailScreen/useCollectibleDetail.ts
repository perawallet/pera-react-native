/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { Share } from 'react-native'
import { useCallback, useMemo, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import {
    useSingleAssetDetailsQuery,
    isPureNft,
    type PeraAsset,
    type PeraCollectible,
    type CollectibleTrait,
    type CollectibleMedia,
} from '@perawallet/wallet-core-assets'
import {
    useSelectedAccount,
    useAllAccounts,
    useAccountAssetBalanceQuery,
    isSigningAccount,
    type AssetWithAccountBalance,
} from '@perawallet/wallet-core-accounts'
import { useAssetOptOutMutation } from '@perawallet/wallet-core-transactions'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import { Decimal } from 'decimal.js'
import { getNetworkConfig } from '@perawallet/wallet-core-config'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import * as Clipboard from 'expo-clipboard'
import { File, Paths } from 'expo-file-system'
import * as MediaLibrary from 'expo-media-library'
import * as Haptics from 'expo-haptics'
import { useModalState, type ModalState } from '@hooks/useModalState'
import type { FullScreenMediaItem } from '@modules/assets/screens/FullScreenImageViewer/FullScreenImageViewer'

type UseCollectibleDetailResult = {
    asset: PeraAsset | undefined
    collectible: PeraCollectible | undefined
    isPending: boolean
    isPure: boolean
    isWatch: boolean
    traits: CollectibleTrait[]
    media: CollectibleMedia[]
    accountAddress: string
    accountName: string
    assetAmount: Decimal
    isOptedIn: boolean
    isOwned: boolean
    isOptedInNotOwned: boolean
    assetBalance: AssetWithAccountBalance | null
    isOptingOut: boolean
    optOutModal: ModalState
    modelViewerModal: ModalState
    modelViewerUrl: string | undefined
    handleOptOutPressed: () => void
    handleConfirmOptOut: () => void
    handleSendPressed: () => void
    handleSharePressed: () => void
    handleCopyImage: () => void
    handleSaveImage: () => void
    handleMediaPress: (index: number) => void
    fullScreenMedia: FullScreenMediaItem[]
    fullScreenInitialIndex: number
    fullScreenViewerModal: ModalState
    sendFundsModal: ModalState
    hasExplorerUrl: boolean
    hasProjectUrl: boolean
}

export const useCollectibleDetail = (
    assetId: string,
): UseCollectibleDetailResult => {
    const { data: asset, isPending } = useSingleAssetDetailsQuery(
        assetId,
        false,
    )
    const account = useSelectedAccount()
    const { network } = useNetwork()
    const allAccounts = useAllAccounts()
    const { t } = useLanguage()
    const { data: assetBalance } = useAccountAssetBalanceQuery(
        account ?? undefined,
        assetId,
    )
    const fullScreenViewerModal = useModalState()
    const sendFundsModal = useModalState()
    const optOutModal = useModalState()
    const modelViewerModal = useModalState()
    const [modelViewerUrl, setModelViewerUrl] = useState<string | null>(null)
    const { optOut, isLoading: isOptingOut } = useAssetOptOutMutation()
    const navigation = useNavigation()
    const [fullScreenInitialIndex, setFullScreenInitialIndex] = useState(0)

    const collectible = asset?.peraMetadata?.collectible
    const isWatch = account ? !isSigningAccount(account, allAccounts) : true
    const isPure = asset ? isPureNft(asset) : false
    const traits = collectible?.traits ?? []
    const media = collectible?.media ?? []

    const accountAddress = account?.address ?? ''
    const accountName = account?.name ?? accountAddress
    const assetAmount = assetBalance?.amount ?? new Decimal(0)
    const isOptedIn = assetBalance != null
    const isOwned = isOptedIn && assetAmount.greaterThan(0)
    const isOptedInNotOwned = isOptedIn && !isOwned
    const { showToast } = useToast()

    const explorerUrl =
        collectible?.explorerUrl ?? asset?.peraMetadata?.explorerUrl
    const projectUrl = asset?.peraMetadata?.projectUrl

    const getImageUrl = useCallback(() => {
        const firstImageMedia = media.find(m => m.type === 'image')
        return (
            firstImageMedia?.downloadUrl ??
            firstImageMedia?.previewUrl ??
            collectible?.primaryImage ??
            undefined
        )
    }, [media, collectible?.primaryImage])

    const handleSendPressed = useCallback(() => {
        sendFundsModal.open()
    }, [sendFundsModal])

    const handleOptOutPressed = useCallback(() => {
        optOutModal.open()
    }, [optOutModal])

    const handleConfirmOptOut = useCallback(async () => {
        if (!account || !asset) {
            return
        }

        try {
            await optOut({
                sender: account.address,
                assetId: BigInt(assetId),
                creator: asset.creator.address,
            })
            optOutModal.close()
            showToast({
                title: t('asset_opt_out.success'),
                body: '',
                type: 'success',
            })
            if (navigation.canGoBack()) {
                navigation.goBack()
            }
        } catch (err) {
            optOutModal.close()
            showToast({
                title: t('asset_opt_out.error'),
                body: err instanceof Error ? err.message : '',
                type: 'error',
            })
        }
    }, [account, asset, assetId, navigation, optOut, optOutModal, showToast, t])

    const handleCopyImage = useCallback(async () => {
        const imageUrl = getImageUrl()
        if (!imageUrl) return

        try {
            const dest = new File(Paths.cache, `collectible_${assetId}`)
            const file = await File.downloadFileAsync(imageUrl, dest, {
                idempotent: true,
            })
            const base64 = await file.base64()

            await Clipboard.setImageAsync(base64)
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            showToast({
                title: t('asset_details.collectible.image_copied'),
                body: '',
                type: 'success',
            })
        } catch {
            showToast({
                title: t('asset_details.collectible.image_copy_failed'),
                body: '',
                type: 'error',
            })
        }
    }, [assetId, getImageUrl, showToast, t])

    const handleSaveImage = useCallback(async () => {
        const imageUrl = getImageUrl()
        if (!imageUrl) return

        try {
            const { status } = await MediaLibrary.requestPermissionsAsync()

            if (status !== 'granted') {
                showToast({
                    title: t(
                        'asset_details.collectible.photo_permission_denied',
                    ),
                    body: '',
                    type: 'error',
                })
                return
            }

            const extension =
                media.find(m => m.type === 'image')?.extension ?? 'png'
            const dest = new File(
                Paths.cache,
                `collectible_${assetId}.${extension}`,
            )
            const file = await File.downloadFileAsync(imageUrl, dest, {
                idempotent: true,
            })

            await MediaLibrary.saveToLibraryAsync(file.uri)
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            showToast({
                title: t('asset_details.collectible.image_saved'),
                body: '',
                type: 'success',
            })
        } catch {
            showToast({
                title: t('asset_details.collectible.image_save_failed'),
                body: '',
                type: 'error',
            })
        }
    }, [assetId, getImageUrl, media, showToast, t])

    const handleSharePressed = useCallback(() => {
        const config = getNetworkConfig(network)
        const url = config.explorerUrl
            ? `${config.explorerUrl}/asset/${assetId}`
            : undefined

        Share.share({
            message: t('asset_details.collectible.share_message'),
            url,
        })
    }, [assetId])

    const fullScreenMedia = useMemo<FullScreenMediaItem[]>(() => {
        const posterFallback =
            collectible?.primaryImage ?? asset?.peraMetadata?.logo ?? undefined

        const items: FullScreenMediaItem[] = []
        for (const m of media) {
            if (
                m.type !== 'image' &&
                m.type !== 'video' &&
                m.type !== 'audio'
            ) {
                continue
            }
            const uri = m.downloadUrl ?? m.previewUrl
            if (!uri) continue
            if (m.type === 'video') {
                items.push({ uri, type: 'video' })
            } else if (m.type === 'audio') {
                items.push({ uri, type: 'audio', posterUri: posterFallback })
            } else {
                items.push({ uri, type: 'image' })
            }
        }

        if (!items.length && posterFallback) {
            return [{ uri: posterFallback, type: 'image' }]
        }
        return items
    }, [media, collectible, asset])

    const handleMediaPress = useCallback(
        (index: number) => {
            const item = media[index]
            if (item?.type === 'model') {
                const url = item.downloadUrl ?? item.previewUrl
                if (!url) return
                setModelViewerUrl(url)
                modelViewerModal.open()
                return
            }
            if (fullScreenMedia.length > 0) {
                setFullScreenInitialIndex(
                    Math.min(index, fullScreenMedia.length - 1),
                )
                fullScreenViewerModal.open()
            }
        },
        [media, fullScreenMedia, fullScreenViewerModal, modelViewerModal],
    )

    return {
        asset,
        collectible,
        isPending,
        isPure,
        isWatch,
        traits,
        media,
        accountAddress,
        accountName,
        assetAmount,
        isOptedIn,
        isOwned,
        isOptedInNotOwned,
        assetBalance: assetBalance ?? null,
        isOptingOut,
        optOutModal,
        modelViewerModal,
        modelViewerUrl: modelViewerUrl ?? undefined,
        handleOptOutPressed,
        handleConfirmOptOut,
        handleSendPressed,
        handleSharePressed,
        handleCopyImage,
        handleSaveImage,
        handleMediaPress,
        fullScreenMedia,
        fullScreenInitialIndex,
        fullScreenViewerModal,
        sendFundsModal,
        hasExplorerUrl: !!explorerUrl,
        hasProjectUrl: !!projectUrl,
    }
}
