import { View, Linking } from 'react-native'
import { useStyles } from './styles'
import { AssetDetailSerializerResponse, truncateAlgorandAddress } from '@perawallet/core'
import Clipboard from '@react-native-clipboard/clipboard'
import { Text, useTheme } from '@rneui/themed'
import PWButton from '../../../common/button/PWButton'
import RowTitledItem from '../../../common/row-titled-item/RowTitledItem'
import useToast from '../../../../hooks/toast'

type AssetAboutProps = {
    assetDetails: AssetDetailSerializerResponse
}

const AssetAbout = ({ assetDetails }: AssetAboutProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { showToast } = useToast()

    const copyToClipboard = (text: string) => {
        Clipboard.setString(text)
        showToast({
            title: 'Copied to clipboard',
            body: '',
            type: 'success',
        })
    }

    const openLink = (url: string) => {
        // TODO: Open link in webview
        Linking.openURL(url)
    }

    return (
        <View style={styles.container}>
            {!!assetDetails.asset_id && <Text style={styles.sectionTitle}>About {assetDetails.name}</Text>}
            {!!assetDetails.asset_id && (
                <RowTitledItem title='ASA ID'>
                    <PWButton
                        title={assetDetails.asset_id.toString()}
                        onPress={() =>
                            copyToClipboard(assetDetails.asset_id.toString())
                        }
                        variant='link'
                    />
                </RowTitledItem>)}

            {!!assetDetails.creator?.address && (
                <RowTitledItem title='Creator'>
                    <PWButton
                        title={truncateAlgorandAddress(assetDetails.creator.address)}
                        onPress={() =>
                            copyToClipboard(assetDetails.creator.address)
                        }
                        variant='link'
                    />
                </RowTitledItem>)}

            {!!assetDetails.url && (
                <RowTitledItem title='ASA URL'>
                    <PWButton
                        onPress={() =>
                            openLink(assetDetails.url ?? '')
                        }
                        variant="link"
                    />
                </RowTitledItem>
            )}

            {!!assetDetails.explorer_url?.length && (
                <RowTitledItem title='Show on'>
                    <PWButton
                        onPress={() =>
                            assetDetails.explorer_url &&
                            openLink(assetDetails.explorer_url)
                        }
                        variant="link"
                    />
                </RowTitledItem>)}

            {!!assetDetails.project_url?.length && (
                <RowTitledItem title='Project website'>
                    <PWButton
                        title='Open with Browser'
                        onPress={() => openLink(assetDetails.project_url!)}
                        variant="link"
                    />
                </RowTitledItem>
            )}
        </View>
    )
}

export default AssetAbout
