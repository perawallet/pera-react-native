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
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { PWIcon, PWText, PWView } from '@components/core'
import { CopyableText } from '@components/CopyableText'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { useAssetTitle } from './useAssetTitle'
import { AssetIcon } from '@components/AssetIcon'
import type { TypographyVariant } from '@theme/typography'

export type AssetTitleProps = {
    asset: PeraAsset
    /** The asset's chain; decides whether it is that chain's native coin. */
    chainId: ChainId
    showId?: boolean
    nameVariant?: TypographyVariant
}

export const AssetTitle = ({
    asset,
    chainId,
    showId = false,
    nameVariant = 'h4',
}: AssetTitleProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        displayName,
        verificationIcon,
        isSuspicious,
        isDeleted,
        isIdVisible,
    } = useAssetTitle({ asset, chainId, showId })

    return (
        <PWView style={styles.container}>
            <AssetIcon
                asset={asset}
                chainId={chainId}
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
                        {displayName}
                    </PWText>
                    {verificationIcon && (
                        <PWIcon
                            name={verificationIcon}
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
                {isIdVisible && (
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
