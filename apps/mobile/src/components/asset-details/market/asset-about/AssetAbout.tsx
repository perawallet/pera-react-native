import { View, Linking } from 'react-native'
import { useStyles } from './styles'
import {
    ALGO_ASSET_ID,
    PeraAsset,
    truncateAlgorandAddress,
} from '@perawallet/core'
import Clipboard from '@react-native-clipboard/clipboard'
import { Text } from '@rneui/themed'
import PWButton from '../../../common/button/PWButton'
import RowTitledItem from '../../../common/row-titled-item/RowTitledItem'
import useToast from '../../../../hooks/toast'

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
            {!!assetDetails.asset_id && (
                <Text style={styles.sectionTitle}>
                    About {assetDetails.name}
                </Text>
            )}
            {!!assetDetails.asset_id && (
                <RowTitledItem
                    title='ASA ID'
                    verticalAlignment='center'
                >
                    <PWButton
                        title={assetDetails.asset_id.toString()}
                        onPress={() =>
                            copyToClipboard(assetDetails.asset_id.toString())
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
                        assetDetails.asset_id === ALGO_ASSET_ID
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

            {!!assetDetails.explorer_url?.length && (
                <RowTitledItem
                    title='Show on'
                    verticalAlignment='center'
                >
                    <PWButton
                        onPress={() =>
                            assetDetails.explorer_url &&
                            openLink(assetDetails.explorer_url)
                        }
                        variant='link'
                        paddingStyle='none'
                    />
                </RowTitledItem>
            )}

            {!!assetDetails.project_url?.length && (
                <RowTitledItem
                    title='Project website'
                    verticalAlignment='center'
                >
                    <PWButton
                        title='Open with Browser'
                        onPress={() => openLink(assetDetails.project_url!)}
                        variant='link'
                    />
                </RowTitledItem>
            )}
        </View>
    )
}

export default AssetAbout
