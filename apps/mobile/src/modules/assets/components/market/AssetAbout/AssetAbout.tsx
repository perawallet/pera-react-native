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

import { useStyles } from './styles'
import { PWButton, PWText, PWView } from '@components/core'
import { KeyValueRow } from '@components/KeyValueRow'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import { useLanguage } from '@hooks/useLanguage'
import type { AssetAboutDisplay } from '@modules/assets/types/asset-details-display'
import { getAssetAboutVisibility } from './getAssetAboutVisibility'
import { useAssetAbout } from './useAssetAbout'

export type AssetAboutProps = {
    assetDetails: PeraAsset
    about: AssetAboutDisplay
}

export const AssetAbout = ({ assetDetails, about }: AssetAboutProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        creatorDisplayName,
        assetLink,
        explorerLink,
        projectUrl,
        copyToClipboard,
        openLink,
    } = useAssetAbout(assetDetails, about)
    const { isVisible, hasIdRow, hasCreatorRow } = getAssetAboutVisibility(
        assetDetails,
        about,
        { assetLink, explorerLink, projectUrl },
    )

    if (!isVisible) {
        return null
    }

    return (
        <PWView style={styles.container}>
            <PWText
                style={styles.sectionTitle}
                truncate
            >
                {t('asset_details.about.title', {
                    name: assetDetails.name,
                })}
            </PWText>

            {hasIdRow && !!about.idLabelKey && (
                <KeyValueRow
                    title={t(about.idLabelKey)}
                    verticalAlignment='center'
                >
                    <PWButton
                        title={assetDetails.assetId.toString()}
                        onPress={() =>
                            void copyToClipboard(
                                assetDetails.assetId.toString(),
                            )
                        }
                        variant='linkPositive'
                        paddingStyle='none'
                    />
                </KeyValueRow>
            )}

            {hasCreatorRow && (
                <KeyValueRow
                    title={t('asset_details.about.creator')}
                    verticalAlignment='center'
                >
                    <PWButton
                        title={creatorDisplayName}
                        onPress={() =>
                            void copyToClipboard(assetDetails.creator.address)
                        }
                        variant='linkPositive'
                        paddingStyle='none'
                    />
                </KeyValueRow>
            )}

            {!!assetLink && (
                <KeyValueRow
                    title={t(about.urlLabelKey)}
                    verticalAlignment='center'
                >
                    <PWButton
                        onPress={() => openLink(assetLink.url)}
                        title={assetLink.label}
                        variant='link'
                        paddingStyle='none'
                    />
                </KeyValueRow>
            )}

            {!!explorerLink && (
                <KeyValueRow
                    title={t('asset_details.about.show_on')}
                    verticalAlignment='center'
                >
                    <PWButton
                        onPress={() => openLink(explorerLink.url)}
                        title={explorerLink.label}
                        variant='link'
                        paddingStyle='none'
                    />
                </KeyValueRow>
            )}

            {!!projectUrl && (
                <KeyValueRow
                    title={t('asset_details.about.project_website')}
                    verticalAlignment='center'
                >
                    <PWButton
                        title={t('asset_details.about.open_browser')}
                        onPress={() => openLink(projectUrl)}
                        variant='link'
                    />
                </KeyValueRow>
            )}
        </PWView>
    )
}
