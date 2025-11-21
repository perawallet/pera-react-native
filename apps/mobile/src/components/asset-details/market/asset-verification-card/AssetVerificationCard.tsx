import { useStyles } from './styles'
import { ALGO_ASSET_ID, PeraAsset } from '@perawallet/core'
import { Text, useTheme } from '@rneui/themed'
import PWView from '../../../common/view/PWView'
import PWIcon, { IconName } from '../../../common/icons/PWIcon'
import PWButton from '../../../common/button/PWButton'
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
    const isTrusted = assetDetails.asset_id === ALGO_ASSET_ID
    const isVerified =
        !isTrusted && assetDetails.verification_tier === 'verified'
    const isSuspicious = assetDetails.verification_tier === 'suspicious'

    if (!isVerified && !isTrusted && !isSuspicious) {
        return null
    }

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
        return [
            CARD_CONFIGS.suspicious,
            { backgroundColor: theme.colors.asaSuspiciousBg },
            { color: theme.colors.asaSuspiciousText },
        ]
    }, [isTrusted, isVerified, isSuspicious])

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
