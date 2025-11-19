import { Linking } from 'react-native'
import { useStyles } from './styles'
import { AssetDetailSerializerResponse } from '@perawallet/core'
import { Text } from '@rneui/themed'
import PWIcon, { IconName } from '../../../common/icons/PWIcon'
import PWView from '../../../common/view/PWView'
import PWTouchableOpacity from '../../../common/touchable-opacity/PWTouchableOpacity'

type AssetSocialMediaProps = {
    assetDetails: AssetDetailSerializerResponse
}

const AssetSocialMedia = ({ assetDetails }: AssetSocialMediaProps) => {
    const styles = useStyles()

    const socialLinks = [
        {
            label: 'Discord',
            url: assetDetails.discord_url,
            icon: 'socials/discord' as IconName,
        },
        {
            label: 'Telegram',
            url: assetDetails.telegram_url,
            icon: 'socials/telegram' as IconName,
        },
        {
            label: 'Twitter',
            url: assetDetails.twitter_username
                ? `https://twitter.com/${assetDetails.twitter_username}`
                : null,
            icon: 'socials/twitter' as IconName,
        },
    ].filter(link => link.url)

    if (socialLinks.length === 0) {
        return null
    }

    const openLink = (url: string) => {
        //TODO open in webview - we might want a hook for this
        Linking.openURL(url)
    }

    return (
        <PWView style={styles.container}>
            {socialLinks.map((link, index) => (
                <PWTouchableOpacity
                    key={index}
                    style={styles.row}
                    onPress={() => openLink(link.url!)}
                >
                    <PWView style={styles.labelContainer}>
                        <PWIcon
                            name={link.icon}
                            size="md"
                            variant='secondary'
                        />
                        <Text style={styles.label}>{link.label}</Text>
                    </PWView>
                    <PWIcon
                        name='arrow-up-right'
                        size="sm"
                        variant='secondary'
                    />
                </PWTouchableOpacity>
            ))}
        </PWView>
    )
}

export default AssetSocialMedia
