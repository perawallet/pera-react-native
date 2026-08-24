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

import { type NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AccountStackParamsList } from '@modules/accounts/routes'
import {
    PWButton,
    PWChip,
    PWIcon,
    PWScreen,
    PWText,
    PWTouchableIcon,
    PWView,
} from '@components/core'
import { MediaCarousel } from '@components/MediaCarousel'
import { ModelViewerBottomSheet } from '@components/ModelViewerBottomSheet'
import { EmptyView } from '@components/EmptyView'
import { useLanguage } from '@hooks/useLanguage'
import { useCollectibleDetail } from './useCollectibleDetail'
import { useStyles } from './styles'
import { CollectibleTraitsGrid } from './CollectibleTraitsGrid'
import { CollectibleInfoSection } from './CollectibleInfoSection'
import { AddressDisplay } from '@components/AddressDisplay'
import { RoundButton } from '@components/RoundButton'
import { useNavigationHeader } from '@hooks/useNavigationHeader'
import { CollectibleDetailSkeleton } from './CollectibleDetailSkeleton'
import { CollectibleDescription } from './CollectibleDescription'

export type CollectibleDetailScreenProps = NativeStackScreenProps<
    AccountStackParamsList,
    'CollectibleDetails'
>

export const CollectibleDetailScreen = ({
    route,
}: CollectibleDetailScreenProps) => {
    const assetId = route.params?.assetId ?? ''
    const { t } = useLanguage()

    const {
        asset,
        collectible,
        isPending,
        isReadOnly,
        traits,
        media,
        hasImage,
        hasSaveableMedia,
        accountAddress,
        assetAmount,
        isOptedInNotOwned,
        isFrozen,
        handleSendPressed,
        handleSharePressed,
        handleModelPress,
        handleFullScreenPress,
        handleCopyImage,
        handleSaveImage,
        handleOptOutPressed,
        modelViewerModal,
        modelViewerUrl,
    } = useCollectibleDetail(assetId)

    const styles = useStyles()

    useNavigationHeader({
        right: (
            <PWTouchableIcon
                name='share'
                variant='primary'
                onPress={handleSharePressed}
            />
        ),
    })

    if (isPending || !asset) {
        return (
            <EmptyView
                isLoading={isPending}
                loadingView={<CollectibleDetailSkeleton />}
                title={t('asset_details.markets.something_went_wrong_title')}
                body={t('asset_details.markets.something_went_wrong_body')}
            />
        )
    }

    const displayTitle = collectible?.title ?? asset.name ?? `#${asset.assetId}`
    const collectionLabel = collectible?.collection?.name ?? asset.unitName
    const quantity = assetAmount.toNumber()

    return (
        <>
            <PWScreen
                testID='collectible_detail_screen'
                horizontalPadding='none'
                style={styles.container}
            >
                <PWView style={styles.contentContainer}>
                    <PWView style={styles.titleSection}>
                        <PWText
                            variant='h3'
                            style={styles.title}
                        >
                            {displayTitle}
                        </PWText>
                        {collectionLabel && (
                            <PWText
                                variant='body'
                                style={styles.collectionName}
                            >
                                {collectionLabel}
                            </PWText>
                        )}
                    </PWView>

                    {accountAddress ? (
                        <PWView style={styles.accountRow}>
                            <AddressDisplay
                                address={accountAddress}
                                hugContent
                            />
                            {quantity > 0 && (
                                <PWChip
                                    title={`x${quantity}`}
                                    variant='outline'
                                    paddingStyle='dense'
                                    forceUppercase={false}
                                    textVariant='footnoteMedium'
                                    style={styles.quantityChip}
                                />
                            )}
                        </PWView>
                    ) : null}
                </PWView>
                <PWView
                    style={
                        isOptedInNotOwned
                            ? styles.mediaContainerDimmed
                            : undefined
                    }
                >
                    <MediaCarousel
                        media={media}
                        fallbackImageUrl={
                            collectible?.primaryImage ??
                            asset.peraMetadata?.logo ??
                            undefined
                        }
                        onModelPress={handleModelPress}
                        onFullScreenPress={handleFullScreenPress}
                    />
                </PWView>

                <PWView style={styles.contentContainer}>
                    {!isOptedInNotOwned && !isReadOnly && (
                        <PWView style={styles.actionButtonsContainer}>
                            <RoundButton
                                title={t('common.send')}
                                icon='outflow'
                                variant='primary'
                                size='md'
                                onPress={handleSendPressed}
                                style={
                                    isFrozen ? styles.unavailable : undefined
                                }
                            />
                            {hasImage && (
                                <RoundButton
                                    title={t('common.copy')}
                                    icon='copy'
                                    variant='secondary'
                                    size='md'
                                    onPress={() => void handleCopyImage()}
                                />
                            )}
                            {hasSaveableMedia && (
                                <RoundButton
                                    title={t('common.save')}
                                    icon='save'
                                    variant='secondary'
                                    size='md'
                                    onPress={() => void handleSaveImage()}
                                />
                            )}
                        </PWView>
                    )}

                    {isOptedInNotOwned && !isReadOnly && (
                        <PWView style={styles.optOutNotice}>
                            <PWView style={styles.optOutNoticeRow}>
                                <PWIcon
                                    name='info'
                                    size='md'
                                    variant='secondary'
                                />
                                <PWText
                                    variant='caption'
                                    style={styles.optOutNoticeText}
                                >
                                    {t(
                                        'asset_details.collectible.not_owner_notice',
                                    )}
                                </PWText>
                            </PWView>
                            <PWButton
                                title={t('asset_opt_out.opt_out_cta')}
                                variant='secondary'
                                onPress={() => void handleOptOutPressed()}
                            />
                        </PWView>
                    )}

                    <CollectibleTraitsGrid traits={traits} />

                    <CollectibleDescription
                        description={collectible?.description}
                    />

                    <CollectibleInfoSection
                        asset={asset}
                        collectible={collectible}
                    />
                </PWView>
            </PWScreen>
            {/* Mount the sheet fresh on open. A BottomSheetModal that's been
                mounted and idle no-ops on present() — present() calls
                snapToIndex(), which bails until the modal's container height is
                measured, and that never resolves for a long-lived instance.
                Gating the mount on isOpen means present() runs against a freshly
                laid-out container. */}
            {modelViewerModal.isOpen && (
                <ModelViewerBottomSheet
                    isVisible
                    onClose={modelViewerModal.close}
                    modelUrl={modelViewerUrl ?? ''}
                />
            )}
        </>
    )
}
