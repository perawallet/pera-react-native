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

import type { PeraAsset } from '@perawallet/wallet-core-assets'
import { isAlgoAssetId } from '@perawallet/wallet-core-shared'
import { PWIcon, PWText, PWView } from '@components/core'
import { CopyableText } from '@components/CopyableText'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { AssetIcon } from '../AssetIcon'
import { useMemo } from 'react'
import type { TypographyVariant } from '@theme/typography'

export type AssetTitleProps = {
    asset: PeraAsset
    showId?: boolean
    nameVariant?: TypographyVariant
}

export const AssetTitle = ({
    asset,
    showId = false,
    nameVariant = 'h4',
}: AssetTitleProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    const isAlgo = useMemo(() => isAlgoAssetId(asset.assetId), [asset.assetId])

    const isSuspicious = useMemo(
        () => asset.peraMetadata?.verificationTier === 'suspicious',
        [asset.peraMetadata?.verificationTier],
    )

    const isDeleted = asset.peraMetadata?.isDeleted === true

    return (
        <PWView style={styles.container}>
            <AssetIcon
                asset={asset}
                size='lg'
            />
            <PWView style={styles.textContainer}>
                <PWView style={styles.nameContainer}>
                    <PWText
                        variant={nameVariant}
                        style={
                            isSuspicious ? styles.suspiciousName : styles.name
                        }
                        truncate
                    >
                        {isAlgo ? 'Algo' : asset.name}
                    </PWText>
                    {isAlgo && (
                        <PWIcon
                            name='assets/trusted'
                            size={'sm'}
                        />
                    )}
                    {!isAlgo &&
                        asset.peraMetadata?.verificationTier === 'verified' && (
                            <PWIcon
                                name='assets/verified'
                                size={'sm'}
                            />
                        )}
                    {!isAlgo && isSuspicious && (
                        <PWIcon
                            name='assets/suspicious'
                            size={'sm'}
                        />
                    )}
                </PWView>
                {isDeleted && (
                    <PWText
                        variant='caption'
                        style={styles.deletedLabel}
                    >
                        {t('asset.deleted_label')}
                    </PWText>
                )}
                {!isDeleted && showId && (
                    <CopyableText copyValue={String(asset.assetId)}>
                        <PWText
                            variant='caption'
                            style={styles.id}
                        >
                            {asset.assetId}
                        </PWText>
                    </CopyableText>
                )}
            </PWView>
        </PWView>
    )
}
