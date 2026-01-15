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

import { useStyles } from './styles'
import { PeraAsset } from '@perawallet/wallet-core-assets'
import { Text } from '@rneui/themed'
import { PWIcon, IconName } from '@components/PWIcon'
import { PWView } from '@components/PWView'
import { PWTouchableOpacity } from '@components/PWTouchableOpacity'
import { useLanguage } from '@hooks/language'
import { useWebView } from '@hooks/webview'
import { v7 as uuid } from 'uuid'

type AssetSocialMediaProps = {
    assetDetails: PeraAsset
}

export const AssetSocialMedia = ({ assetDetails }: AssetSocialMediaProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { pushWebView } = useWebView()

    const socialLinks = [
        {
            label: 'Discord',
            url: assetDetails.peraMetadata?.discordUrl,
            icon: 'socials/discord' as IconName,
        },
        {
            label: 'Telegram',
            url: assetDetails.peraMetadata?.telegramUrl,
            icon: 'socials/telegram' as IconName,
        },
        {
            label: 'Twitter',
            url: assetDetails.peraMetadata?.twitterUsername
                ? `https://twitter.com/${assetDetails.peraMetadata?.twitterUsername}`
                : null,
            icon: 'socials/twitter' as IconName,
        },
    ].filter(link => link.url)

    if (socialLinks.length === 0) {
        return null
    }

    const openLink = (url: string) => {
        pushWebView({
            id: uuid(),
            url,
        })
    }

    return (
        <PWView style={styles.container}>
            <Text style={styles.sectionTitle}>
                {t('asset_details.markets.social_media')}
            </Text>
            {socialLinks.map((link, index) => (
                <PWTouchableOpacity
                    key={index}
                    style={styles.row}
                    onPress={() => openLink(link.url!)}
                >
                    <PWView style={styles.labelContainer}>
                        <PWIcon
                            name={link.icon}
                            size='md'
                            variant='secondary'
                        />
                        <Text style={styles.label}>{link.label}</Text>
                    </PWView>
                    <PWIcon
                        name='arrow-up-right'
                        size='sm'
                        variant='secondary'
                    />
                </PWTouchableOpacity>
            ))}
        </PWView>
    )
}
