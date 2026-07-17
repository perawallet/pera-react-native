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
import * as MediaLibrary from 'expo-media-library/legacy'
import * as Haptics from 'expo-haptics'
import { useModalState, type ModalState } from '@hooks/useModalState'
import { routeCapabilities } from '@routes/capabilities'
import { useBottomSheet } from '@modules/bottom-sheet'
import { OptOutConfirmationContent } from '@modules/accounts/components/AccountAssetList/OptOutConfirmationContent'
import { SendFundsContent } from '@modules/transactions/components/send-funds/SendFundsContent'
import {
    FullScreenMediaViewer,
    type FullScreenMediaItem,
} from '@modules/assets/screens/FullScreenMediaViewer/FullScreenMediaViewer'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'

type UseCollectibleDetailResult = {
    asset: Optional<PeraAsset>
    collectible: Optional<PeraCollectible>
    isPending: boolean
    isReadOnly: boolean
    traits: CollectibleTrait[]
    media: CollectibleMedia[]
    hasImage: boolean
    hasSaveableMedia: boolean
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
    handleOptOutPressed: () => Promise<void>
    handleSendPressed: () => void
    handleSharePressed: () => void
    handleCopyImage: () => Promise<void>
    handleSaveImage: () => Promise<void>
    handleModelPress: () => void
    handleFullScreenPress: (index: number) => void
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
    const rawMedia = useMemo(
        () => collectible?.media ?? [],
        [collectible?.media],
    )
    // The model viewer needs react-native-webview, which is off-capability on
    // web (inAppWebView is false there). Drop model media from what's exposed
    // so the carousel never renders the 3D badge instead of wiring up a dead
    // tap.
    const media = useMemo(
        () =>
            routeCapabilities.inAppWebView
                ? rawMedia
                : rawMedia.filter(m => m.type !== 'model'),
        [rawMedia],
    )
    const hasImage = useMemo(
        () =>
            rawMedia.some(m => m.type === 'image') ||
            collectible?.primaryImage != null,
        [rawMedia, collectible?.primaryImage],
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
        const firstImageMedia = rawMedia.find(m => m.type === 'image')
        return (
            firstImageMedia?.downloadUrl ??
            firstImageMedia?.previewUrl ??
            collectible?.primaryImage ??
            undefined
        )
    }, [rawMedia, collectible?.primaryImage])

    // Copy stays image-only since it writes a bitmap to the clipboard.
    const saveableMedia = useMemo(
        () =>
            rawMedia.find(
                m =>
                    (m.type === 'image' || m.type === 'video') &&
                    (m.downloadUrl != null || m.previewUrl != null),
            ),
        [rawMedia],
    )
    const saveableMediaUrl =
        saveableMedia?.downloadUrl ??
        saveableMedia?.previewUrl ??
        collectible?.primaryImage ??
        undefined
    const hasSaveableMedia = saveableMediaUrl != null

    const handleSendPressed = useCallback(() => {
        void requestBottomSheet({
            contents: <SendFundsContent assetId={assetId} />,
            options: {
                size: 'modal',
                enablePanDownToClose: false,
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
                    assetId={assetBalance.assetId}
                    accountAddress={account.address}
                />
            ),
            options: {
                size: 'auto',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
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
            void Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
            )
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
        if (!saveableMediaUrl) return

        try {
            // writeOnly: we only save to the gallery, never read it. On
            // Android 13+ this needs no runtime permission (scoped MediaStore
            // write), so the app doesn't request READ_MEDIA_IMAGES — which Play
            // gates under its Photo & Video Permissions policy.
            const { status } = await MediaLibrary.requestPermissionsAsync(true)

            if (status !== 'granted') {
                showToast({
                    title: t(
                        'asset_details.collectible.media_permission_denied',
                    ),
                    body: '',
                    type: 'error',
                })
                return
            }

            const extension = saveableMedia?.extension ?? 'png'
            const dest = new File(
                Paths.cache,
                `collectible_${assetId}.${extension}`,
            )
            const file = await File.downloadFileAsync(saveableMediaUrl, dest, {
                idempotent: true,
            })

            await MediaLibrary.saveToLibraryAsync(file.uri)
            void Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
            )
            showToast({
                title: t('asset_details.collectible.media_saved'),
                body: '',
                type: 'success',
            })
        } catch {
            // guardrails-ignore-next-line no-error-toast-in-catch reason: title-only collectible image-save error; bespoke localized title preserved
            showToast({
                title: t('asset_details.collectible.media_save_failed'),
                body: '',
                type: 'error',
            })
        }
    }, [assetId, saveableMediaUrl, saveableMedia, showToast, t])

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

    // Carousel pages exclude models (shown as a 3D badge); indices below are
    // into this list.
    const visualMedia = useMemo(
        () =>
            rawMedia.filter(
                m =>
                    m.type === 'image' ||
                    m.type === 'video' ||
                    m.type === 'audio',
            ),
        [rawMedia],
    )

    const fullScreenMedia = useMemo<FullScreenMediaItem[]>(() => {
        const posterFallback =
            collectible?.primaryImage ?? asset?.peraMetadata?.logo ?? undefined

        const items: FullScreenMediaItem[] = []
        for (const m of rawMedia) {
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
                items.push({
                    uri,
                    type: 'audio',
                    posterUri: m.previewUrl ?? posterFallback,
                })
            } else {
                items.push({ uri, type: 'image' })
            }
        }

        if (!items.length && posterFallback) {
            return [{ uri: posterFallback, type: 'image' }]
        }
        return items
    }, [rawMedia, collectible, asset])

    const handleModelPress = useCallback(() => {
        // The 3D badge is already hidden on web (see `media` above), but
        // guard here too in case this is ever wired up directly.
        if (!routeCapabilities.inAppWebView) return
        // Only downloadUrl is the real 3D asset; a preview image can't be opened
        // by the model viewer.
        const modelUrl = rawMedia.find(m => m.type === 'model')?.downloadUrl
        if (!modelUrl) return
        setModelViewerUrl(modelUrl)
        modelViewerModal.open()
    }, [rawMedia, modelViewerModal])

    const handleFullScreenPress = useCallback(
        (index: number) => {
            if (fullScreenMedia.length === 0) return
            const item = visualMedia[index]
            const uri = item?.downloadUrl ?? item?.previewUrl
            const matchIndex = fullScreenMedia.findIndex(m => m.uri === uri)
            void requestBottomSheet({
                contents: (
                    <FullScreenMediaViewer
                        media={fullScreenMedia}
                        initialIndex={matchIndex >= 0 ? matchIndex : 0}
                    />
                ),
                options: {
                    size: 'full',
                    enablePanDownToClose: true,
                    autoCreateContainer: false,
                },
            })
        },
        [visualMedia, fullScreenMedia, requestBottomSheet],
    )

    return {
        asset,
        collectible,
        isPending,
        isReadOnly,
        traits,
        media,
        hasImage,
        hasSaveableMedia,
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
        handleModelPress,
        handleFullScreenPress,
        hasExplorerUrl: !!explorerUrl,
        hasProjectUrl: !!projectUrl,
    }
}
