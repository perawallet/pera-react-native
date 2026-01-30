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

import { View } from 'react-native'
import { useStyles } from './styles'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { PWButton, PWText } from '@components/core'
import { KeyValueRow } from '@components/KeyValueRow'
import { ALGO_ASSET_ID, PeraAsset } from '@perawallet/wallet-core-assets'
import { useLanguage } from '@hooks/useLanguage'
import { useWebView } from '@hooks/usePeraWebviewInterface'
import { v7 as uuid } from 'uuid'
import { useClipboard } from '@hooks/useClipboard'

export type AssetAboutProps = {
    assetDetails: PeraAsset
}

export const AssetAbout = ({ assetDetails }: AssetAboutProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { pushWebView } = useWebView()
    const { copyToClipboard } = useClipboard()

    const extractDomain = (url: string) => {
        try {
            const urlObj = new URL(url)
            return urlObj.hostname.startsWith('www.')
                ? urlObj.hostname.slice(4)
                : urlObj.hostname
        } catch {
            return url
        }
    }

    const openLink = (url: string) => {
        pushWebView({
            id: uuid(),
            url,
        })
    }

    return (
        <View style={styles.container}>
            {!!assetDetails.peraMetadata?.description && (
                <KeyValueRow
                    title={t('asset_details.about.title', {
                        name: assetDetails.name,
                    })}
                    verticalAlignment='top'
                >
                    <PWText style={styles.description}>
                        {assetDetails.peraMetadata.description}
                    </PWText>
                </KeyValueRow>
            )}

            {!!assetDetails.assetId &&
                assetDetails.assetId !== ALGO_ASSET_ID && (
                    <KeyValueRow
                        title={t('asset_details.about.asa_id')}
                        verticalAlignment='center'
                    >
                        <PWButton
                            title={assetDetails.assetId.toString()}
                            onPress={() =>
                                copyToClipboard(assetDetails.assetId.toString())
                            }
                            variant='link'
                            paddingStyle='none'
                        />
                    </KeyValueRow>
                )}

            {!!assetDetails.creator?.address && (
                <KeyValueRow
                    title={t('asset_details.about.creator')}
                    verticalAlignment='center'
                >
                    <PWButton
                        title={truncateAlgorandAddress(
                            assetDetails.creator.address,
                        )}
                        onPress={() =>
                            copyToClipboard(assetDetails.creator.address)
                        }
                        variant='link'
                        paddingStyle='none'
                    />
                </KeyValueRow>
            )}

            {!!assetDetails.url?.length && (
                <KeyValueRow
                    title={
                        assetDetails.assetId === ALGO_ASSET_ID
                            ? t('asset_details.about.url')
                            : t('asset_details.about.asa_url')
                    }
                    verticalAlignment='center'
                >
                    <PWButton
                        onPress={() => openLink(assetDetails.url ?? '')}
                        title={extractDomain(assetDetails.url ?? '')}
                        variant='link'
                        paddingStyle='none'
                    />
                </KeyValueRow>
            )}

            {!!assetDetails.peraMetadata?.explorerUrl?.length && (
                <KeyValueRow
                    title={t('asset_details.about.show_on')}
                    verticalAlignment='center'
                >
                    <PWButton
                        onPress={() =>
                            assetDetails.peraMetadata?.explorerUrl &&
                            openLink(assetDetails.peraMetadata?.explorerUrl)
                        }
                        title={
                            assetDetails.assetId === ALGO_ASSET_ID
                                ? 'Algoscan'
                                : 'Pera Explorer'
                        }
                        variant='link'
                        paddingStyle='none'
                    />
                </KeyValueRow>
            )}

            {!!assetDetails.peraMetadata?.projectUrl?.length && (
                <KeyValueRow
                    title={t('asset_details.about.project_website')}
                    verticalAlignment='center'
                >
                    <PWButton
                        title={t('asset_details.about.open_browser')}
                        onPress={() =>
                            openLink(
                                assetDetails.peraMetadata?.projectUrl ?? '',
                            )
                        }
                        variant='link'
                    />
                </KeyValueRow>
            )}
        </View>
    )
}
