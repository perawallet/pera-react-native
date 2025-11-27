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

import { View, Linking } from 'react-native'
import { useStyles } from './styles'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import Clipboard from '@react-native-clipboard/clipboard'
import { Text } from '@rneui/themed'
import PWButton from '../../../../../components/common/button/PWButton'
import RowTitledItem from '../../../../../components/common/row-titled-item/RowTitledItem'
import useToast from '../../../../../hooks/toast'
import { ALGO_ASSET_ID, PeraAsset } from '@perawallet/wallet-core-assets'

type AssetAboutProps = {
    assetDetails: PeraAsset
}

const AssetAbout = ({ assetDetails }: AssetAboutProps) => {
    const styles = useStyles()
    const { showToast } = useToast()

    const copyToClipboard = (text: string) => {
        Clipboard.setString(text)
        showToast({
            title: 'Copied to clipboard',
            body: '',
            type: 'success',
        })
    }

    const extractDomain = (url: string) => {
        const urlObj = new URL(url)
        return urlObj.hostname.startsWith('www.')
            ? urlObj.hostname.slice(4)
            : urlObj.hostname
    }

    const openLink = (url: string) => {
        // TODO: Open link in webview
        Linking.openURL(url)
    }

    return (
        <View style={styles.container}>
            {!!assetDetails.assetId && (
                <Text style={styles.sectionTitle}>
                    About {assetDetails.name}
                </Text>
            )}
            {!!assetDetails.assetId && assetDetails.assetId !== ALGO_ASSET_ID && (
                <RowTitledItem
                    title='ASA ID'
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
                </RowTitledItem>
            )}

            {!!assetDetails.creator?.address && (
                <RowTitledItem
                    title='Creator'
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
                </RowTitledItem>
            )}

            {!!assetDetails.url?.length && (
                <RowTitledItem
                    title={
                        assetDetails.assetId === ALGO_ASSET_ID
                            ? 'URL'
                            : 'ASA URL'
                    }
                    verticalAlignment='center'
                >
                    <PWButton
                        onPress={() => openLink(assetDetails.url ?? '')}
                        title={extractDomain(assetDetails.url ?? '')}
                        variant='link'
                        paddingStyle='none'
                    />
                </RowTitledItem>
            )}

            {!!assetDetails.peraMetadata?.explorerUrl?.length && (
                <RowTitledItem
                    title='Show on'
                    verticalAlignment='center'
                >
                    <PWButton
                        onPress={() =>
                            assetDetails.peraMetadata?.explorerUrl &&
                            openLink(assetDetails.peraMetadata?.explorerUrl)
                        }
                        variant='link'
                        paddingStyle='none'
                    />
                </RowTitledItem>
            )}

            {!!assetDetails.peraMetadata?.projectUrl?.length && (
                <RowTitledItem
                    title='Project website'
                    verticalAlignment='center'
                >
                    <PWButton
                        title='Open with Browser'
                        onPress={() => openLink(assetDetails.peraMetadata?.projectUrl ?? '')}
                        variant='link'
                    />
                </RowTitledItem>
            )}
        </View>
    )
}

export default AssetAbout
