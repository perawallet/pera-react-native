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
import { ALGO_ASSET_ID, PeraAsset } from '@perawallet/wallet-core-assets'
import { Text, useTheme } from '@rneui/themed'
import PWView from '../../../../../components/common/view/PWView'
import PWIcon, { IconName } from '../../../../../components/common/icons/PWIcon'
import PWButton from '../../../../../components/common/button/PWButton'
import { useMemo } from 'react'

type AssetVerificationCardProps = {
    assetDetails: PeraAsset
}

const CARD_CONFIGS = {
    trusted: {
        title: 'Trusted Asset',
        description:
            'The ALGO asset is a core part of the Algorand blockchain.',
        icon: 'assets/trusted' as IconName,
    },
    verified: {
        title: 'Verified ASA',
        description:
            'This ASA was automatically verified through the Pera ASA Verification program.',
        icon: 'assets/verified' as IconName,
    },
    suspicious: {
        title: 'Suspicious ASA',
        description:
            'This ASA has been flagged as suspicious by the Pera ASA Verification program.',
        icon: 'assets/suspicious' as IconName,
    },
}

const AssetVerificationCard = ({
    assetDetails,
}: AssetVerificationCardProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const isTrusted = assetDetails.assetId === ALGO_ASSET_ID
    const isVerified =
        !isTrusted && assetDetails.verificationTier === 'verified'
    const isSuspicious = assetDetails.verificationTier === 'suspicious'

    const [cardConfig, containerStyle, textStyle] = useMemo(() => {
        if (isTrusted) {
            return [
                CARD_CONFIGS.trusted,
                { backgroundColor: theme.colors.asaTrustedBg },
                { color: theme.colors.asaTrustedText },
            ]
        }
        if (isVerified) {
            return [
                CARD_CONFIGS.verified,
                { backgroundColor: theme.colors.asaVerifiedBg },
                { color: theme.colors.asaVerifiedText },
            ]
        }
        if (isSuspicious) {
            return [
                CARD_CONFIGS.suspicious,
                { backgroundColor: theme.colors.asaSuspiciousBg },
                { color: theme.colors.asaSuspiciousText },
            ]
        }
        return [
            CARD_CONFIGS.suspicious,
            { backgroundColor: theme.colors.asaSuspiciousBg },
            { color: theme.colors.asaSuspiciousText },
        ]
    }, [isTrusted, isVerified, isSuspicious, theme])

    if (!isVerified && !isTrusted && !isSuspicious) {
        return null
    }

    return (
        <PWView>
            <PWView style={[styles.container, containerStyle]}>
                <PWIcon
                    name={cardConfig.icon}
                    size='md'
                    style={styles.icon}
                />
                <PWView style={styles.content}>
                    <Text
                        h4
                        style={textStyle}
                    >
                        {cardConfig.title}
                    </Text>
                    <Text style={textStyle}>{cardConfig.description}</Text>
                </PWView>
            </PWView>
            <PWButton
                variant='link'
                icon='info'
                title='Learn more about ASA verification'
            />
        </PWView>
    )
}

export default AssetVerificationCard
