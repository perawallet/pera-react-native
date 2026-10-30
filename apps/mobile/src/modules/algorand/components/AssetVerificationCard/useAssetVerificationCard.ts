/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

import { useCallback, useMemo } from 'react'
import { useTheme } from '@rneui/themed'
import { isNativeAssetId } from '@perawallet/wallet-core-assets'
import { config } from '@perawallet/wallet-core-config'
import { type IconName } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useWebView } from '@modules/webview'
import type { AssetChainSectionProps } from '@modules/assets'

export type UseAssetVerificationCardProps = {
    asset: AssetChainSectionProps['asset']
    scope: AssetChainSectionProps['scope']
}

export type UseAssetVerificationCardResult = {
    isVisible: boolean
    cardConfig: { title: string; description: string; icon: IconName }
    containerStyle: { backgroundColor: string }
    textStyle: { color: string }
    handleLearnMore: () => void
}

export const useAssetVerificationCard = ({
    asset,
    scope,
}: UseAssetVerificationCardProps): UseAssetVerificationCardResult => {
    const { theme } = useTheme()
    const { t } = useLanguage()
    const { pushWebView } = useWebView()

    const handleLearnMore = useCallback(() => {
        pushWebView({ url: config.asaVerificationUrl })
    }, [pushWebView])
    const isTrusted = isNativeAssetId(scope.chainId, asset.assetId)
    const isVerified =
        !isTrusted && asset.peraMetadata?.verificationTier === 'verified'
    const isSuspicious = asset.peraMetadata?.verificationTier === 'suspicious'

    const CARD_CONFIGS = useMemo(
        () => ({
            trusted: {
                title: t('asset_details.verification_card.trusted_title'),
                description: t(
                    'asset_details.verification_card.trusted_description',
                ),
                icon: 'assets/trusted' as IconName,
            },
            verified: {
                title: t('asset_details.verification_card.verified_title'),
                description: t(
                    'asset_details.verification_card.verified_description',
                ),
                icon: 'assets/verified' as IconName,
            },
            suspicious: {
                title: t('asset_details.verification_card.suspicious_title'),
                description: t(
                    'asset_details.verification_card.suspicious_description',
                ),
                icon: 'assets/suspicious' as IconName,
            },
        }),
        [t],
    )

    const [cardConfig, containerStyle, textStyle] = useMemo(() => {
        if (isTrusted) {
            return [
                CARD_CONFIGS.trusted,
                { backgroundColor: theme.colors.trustedBannerBg },
                { color: theme.colors.trustedBannerContent },
            ]
        }
        if (isVerified) {
            return [
                CARD_CONFIGS.verified,
                { backgroundColor: theme.colors.verifiedBannerBg },
                { color: theme.colors.verifiedBannerContent },
            ]
        }
        if (isSuspicious) {
            return [
                CARD_CONFIGS.suspicious,
                { backgroundColor: theme.colors.suspiciousBannerBg },
                { color: theme.colors.suspiciousBannerContent },
            ]
        }
        return [
            CARD_CONFIGS.suspicious,
            { backgroundColor: theme.colors.suspiciousBannerBg },
            { color: theme.colors.suspiciousBannerContent },
        ]
    }, [isTrusted, isVerified, isSuspicious, theme, CARD_CONFIGS])

    return {
        isVisible: isVerified || isTrusted || isSuspicious,
        cardConfig,
        containerStyle,
        textStyle,
        handleLearnMore,
    }
}
