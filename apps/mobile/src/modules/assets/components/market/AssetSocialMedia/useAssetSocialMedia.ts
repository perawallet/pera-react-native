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

import { useCallback } from 'react'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'
import type { IconName } from '@components/core'
import { toValidatedBrowserUrl, useWebView } from '@modules/webview'

type AssetSocialLink = {
    label: string
    url: string
    icon: IconName
}

type UseAssetSocialMediaResult = {
    /** Only links that pass the browser gate, so no row renders a dead tap. */
    socialLinks: AssetSocialLink[]
    openLink: (url: string) => void
}

export const useAssetSocialMedia = (
    assetDetails: PeraAsset,
): UseAssetSocialMediaResult => {
    const { pushWebView } = useWebView()
    const { discordUrl, telegramUrl, twitterUsername } =
        assetDetails.peraMetadata ?? {}

    const candidates: { label: string; url: unknown; icon: IconName }[] = [
        { label: 'Discord', url: discordUrl, icon: 'socials/discord' },
        { label: 'Telegram', url: telegramUrl, icon: 'socials/telegram' },
        {
            label: 'Twitter',
            url: twitterUsername
                ? `https://twitter.com/${twitterUsername}`
                : null,
            icon: 'socials/twitter',
        },
    ]

    const socialLinks = candidates.flatMap(({ label, url, icon }) => {
        const validatedUrl = toValidatedBrowserUrl(url)
        return validatedUrl ? [{ label, url: validatedUrl, icon }] : []
    })

    const openLink = useCallback(
        (url: string) => {
            const validatedUrl = toValidatedBrowserUrl(url)
            if (!validatedUrl) return
            pushWebView({
                id: generateOrderedUniqueId(),
                url: validatedUrl,
            })
        },
        [pushWebView],
    )

    return { socialLinks, openLink }
}
