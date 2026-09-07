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

import type { ReactNode } from 'react'
import {
    PWBadge,
    PWIcon,
    type PWIconSize,
    PWText,
    PWTouchableOpacity,
    type PWTouchableOpacityProps,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import type { DisplayableAsset } from '@perawallet/wallet-core-assets'
import { AssetIcon } from '../AssetIcon'
import { useAssetItemView } from './useAssetItemView'
import { useStyles } from './styles'

export type AssetItemViewProps = {
    asset: DisplayableAsset
    /** Right-hand content: balance display (account) or add button (search). */
    right?: ReactNode
    iconSize?: PWIconSize
    /** Logo URL forwarded to the asset icon, bypassing Prism optimization. */
    logoUrl?: string
    /** Account-only decorations. Default off so search rows stay clean. */
    showFavorite?: boolean
    showDeletedLabel?: boolean
    /** Marks a holding-level frozen asset (selection contexts). */
    showFrozenBadge?: boolean
    copyableAssetId?: boolean
} & PWTouchableOpacityProps

export const AssetItemView = ({
    asset,
    right,
    iconSize = 'xl',
    logoUrl,
    showFavorite = false,
    showDeletedLabel = false,
    showFrozenBadge = false,
    copyableAssetId = false,
    onPress,
    style,
    ...rest
}: AssetItemViewProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        isSuspicious,
        isDeleted,
        displayName,
        secondaryText,
        verificationIcon,
        iconShape,
        onCopyAssetId,
    } = useAssetItemView(asset, { copyableAssetId })

    const isFavorited = showFavorite && asset.peraMetadata?.isFavorited === true
    const showDeleted = showDeletedLabel && isDeleted

    const subtitle = showDeleted ? (
        <PWText
            style={styles.deletedLabel}
            numberOfLines={1}
            testID='deleted-label'
        >
            {t('asset.deleted_label')}
        </PWText>
    ) : (
        <PWText
            // Account rows (copyableAssetId) have always shown the subtitle at
            // body size, search rows at caption; kept as-is when the copy
            // long-press moved from the subtitle text to the whole row.
            variant={copyableAssetId ? 'body' : 'caption'}
            style={styles.subtitle}
            numberOfLines={1}
        >
            {secondaryText}
        </PWText>
    )

    return (
        <PWTouchableOpacity
            testID={`asset_row_${asset.assetId}`}
            activeOpacity={onPress || onCopyAssetId ? undefined : 1}
            onPress={onPress}
            onLongPress={onCopyAssetId}
            accessibilityHint={onCopyAssetId ? 'Long press to copy' : undefined}
            {...rest}
            style={[styles.itemContainer, style]}
        >
            <AssetIcon
                asset={asset}
                logoUrl={logoUrl}
                size={iconSize}
                shape={iconShape}
            />
            <PWView style={styles.infoContainer}>
                <PWView style={styles.titleRow}>
                    <PWText
                        variant='h4'
                        style={
                            isSuspicious
                                ? styles.suspiciousTitle
                                : styles.titleText
                        }
                        ellipsizeMode='middle'
                        numberOfLines={1}
                    >
                        {displayName}
                    </PWText>
                    {isFavorited ? (
                        <PWIcon
                            name='star-filled'
                            size='xs'
                            variant='favorite'
                            testID='favorite-star-icon'
                        />
                    ) : null}
                    {verificationIcon ? (
                        <PWIcon
                            name={verificationIcon}
                            size='xs'
                        />
                    ) : null}
                    {showFrozenBadge ? (
                        <PWBadge
                            variant='secondary'
                            value={t('transactions.asset_freeze.frozen')}
                        />
                    ) : null}
                </PWView>
                {subtitle}
            </PWView>
            {right ? <PWView style={styles.rightSlot}>{right}</PWView> : null}
        </PWTouchableOpacity>
    )
}
