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

import { useCallback, useMemo, useState } from 'react'
import { shareText } from '@utils/shareText'
import { useNavigation } from '@react-navigation/native'
import {
    useSingleAssetDetailsQuery,
    type PeraAsset,
    type PeraCollectible,
    type CollectibleTrait,
    type CollectibleMedia,
} from '@perawallet/wallet-core-assets'
import {
    useSelectedAccount,
    useCanSignWith,
    useAccountAssetBalanceQuery,
    type AssetWithAccountBalance,
} from '@perawallet/wallet-core-accounts'
import { UserRejectedSigningError } from '@perawallet/wallet-core-signing'
import { useAssetOptOutMutation } from '@perawallet/wallet-core-transactions'
import { useErrorToast } from '@hooks/useErrorToast'
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
import { useBottomSheet } from '@modules/bottom-sheet'
import { OptOutConfirmationContent } from '@modules/accounts/components/AccountAssetList/OptOutConfirmationContent'
import { SendFundsContent } from '@modules/transactions/components/send-funds/SendFundsContent'
import {
    FullScreenImageViewer,
    type FullScreenMediaItem,
} from '@modules/assets/screens/FullScreenImageViewer/FullScreenImageViewer'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'

type UseCollectibleDetailResult = {
    asset: Optional<PeraAsset>
    collectible: Optional<PeraCollectible>
    isPending: boolean
    isReadOnly: boolean
    traits: CollectibleTrait[]
    media: CollectibleMedia[]
    /** Whether there's an image to copy/save (image media or a primary image). */
    hasImage: boolean
    accountAddress: string
    accountName: string
    assetAmount: Decimal
    isOptedIn: boolean
    isOwned: boolean
    isOptedInNotOwned: boolean
    assetBalance: Nullable<AssetWithAccountBalance>
    isOptingOut: boolean
    modelViewerModal: ModalState
    modelViewerUrl: Optional<string>
    handleOptOutPressed: () => void
    handleSendPressed: () => void
    handleSharePressed: () => void
    handleCopyImage: () => void
    handleSaveImage: () => void
    handleMediaPress: (index: number) => void
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
    const isReadOnly = !useCanSignWith(account)
    const { t } = useLanguage()
    const { data: assetBalance } = useAccountAssetBalanceQuery(
        account ?? undefined,
        assetId,
    )
    const modelViewerModal = useModalState()
    const { request: requestBottomSheet } = useBottomSheet()
    const [modelViewerUrl, setModelViewerUrl] = useState<Nullable<string>>(null)
    const { optOut, isLoading: isOptingOut } = useAssetOptOutMutation()
    const navigation = useNavigation()

    const collectible = asset?.peraMetadata?.collectible
    const traits = collectible?.traits ?? []
    const media = collectible?.media ?? []
    const hasImage = useMemo(
        () =>
            media.some(m => m.type === 'image') ||
            collectible?.primaryImage != null,
        [media, collectible?.primaryImage],
    )

    const accountAddress = account?.address ?? ''
    const accountName = account?.name ?? accountAddress
    const assetAmount = assetBalance?.amount ?? new Decimal(0)
    const isOptedIn = assetBalance != null
    const isOwned = isOptedIn && assetAmount.greaterThan(0)
    const isOptedInNotOwned = isOptedIn && !isOwned
    const { showToast } = useToast()
    const { showError } = useErrorToast()

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
        void requestBottomSheet({
            contents: <SendFundsContent assetId={assetId} />,
            options: {
                size: 'modal',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [requestBottomSheet, assetId])

    const handleOptOutPressed = useCallback(async () => {
        if (!account || !asset || !assetBalance) {
            return
        }
        const result = await requestBottomSheet<'confirm'>({
            contents: (
                <OptOutConfirmationContent
                    accountBalance={assetBalance}
                    accountAddress={account.address}
                />
            ),
            options: { size: 'auto', enablePanDownToClose: true },
        })
        if (result !== 'confirm') return

        try {
            await optOut({
                sender: account.address,
                assetId: BigInt(assetId),
                creator: asset.creator.address,
            })
            showToast({
                title: t('asset_opt_out.success'),
                body: '',
                type: 'success',
            })
            if (navigation.canGoBack()) {
                navigation.goBack()
            }
        } catch (err) {
            if (err instanceof UserRejectedSigningError) {
                // User dismissed the LedgerSigningContent sheet — sheet already went away; no toast.
                return
            }
            showError(err, t('asset_opt_out.error'))
        }
    }, [
        account,
        asset,
        assetId,
        assetBalance,
        requestBottomSheet,
        navigation,
        optOut,
        showToast,
        t,
        showError,
    ])

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
            // guardrails-ignore-next-line no-error-toast-in-catch reason: title-only collectible image-copy error; bespoke localized title preserved
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
            // guardrails-ignore-next-line no-error-toast-in-catch reason: title-only collectible image-save error; bespoke localized title preserved
            showToast({
                title: t('asset_details.collectible.image_save_failed'),
                body: '',
                type: 'error',
            })
        }
    }, [assetId, getImageUrl, media, showToast, t])

    const handleSharePressed = useCallback(() => {
        const networkConfig = getNetworkConfig(network)
        const url = networkConfig.explorerUrl
            ? `${networkConfig.explorerUrl}/asset/${assetId}`
            : undefined

        void shareText({
            message: t('asset_details.collectible.share_message'),
            url,
        })
    }, [assetId, network, t])

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
                const initialIndex = Math.min(index, fullScreenMedia.length - 1)
                void requestBottomSheet({
                    contents: (
                        <FullScreenImageViewer
                            media={fullScreenMedia}
                            initialIndex={initialIndex}
                        />
                    ),
                    options: {
                        size: 'full',
                        enablePanDownToClose: true,
                        // The viewer owns a full-bleed PagerView that needs a
                        // bounded height; the default gorhom `BottomSheetView`
                        // is position-absolute / content-sized, which collapses
                        // it. A plain flex container fills the `full` sheet.
                        autoCreateContainer: false,
                    },
                })
            }
        },
        [media, fullScreenMedia, modelViewerModal, requestBottomSheet],
    )

    return {
        asset,
        collectible,
        isPending,
        isReadOnly,
        traits,
        media,
        hasImage,
        accountAddress,
        accountName,
        assetAmount,
        isOptedIn,
        isOwned,
        isOptedInNotOwned,
        assetBalance: assetBalance ?? null,
        isOptingOut,
        modelViewerModal,
        modelViewerUrl: modelViewerUrl ?? undefined,
        handleOptOutPressed,
        handleSendPressed,
        handleSharePressed,
        handleCopyImage,
        handleSaveImage,
        handleMediaPress,
        hasExplorerUrl: !!explorerUrl,
        hasProjectUrl: !!projectUrl,
    }
}
