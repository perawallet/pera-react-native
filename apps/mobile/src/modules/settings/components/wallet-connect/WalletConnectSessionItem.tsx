import PWBadge from "@components/badge/PWBadge"
import PWView from "@components/view/PWView"
import { WalletConnectSession } from "@perawallet/wallet-core-walletconnect"
import { Image, Text } from "@rneui/themed"
import { useStyles } from "./styles"
import PWTouchableOpacity from "@components/touchable-opacity/PWTouchableOpacity"
import PWIcon from "@components/icons/PWIcon"
import { useLanguage } from "@hooks/language"
import { formatDatetime } from "@perawallet/wallet-core-shared"
import { ParamListBase, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

//TODO implement session item
const WalletConnectSessionItem = ({
    session,
}: {
    session: WalletConnectSession
}) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const isConnected = session.connected

    const preferredIcon = session?.session?.peerMeta?.icons?.find(icon => icon.endsWith('.png') || icon.endsWith('.jpg') || icon.endsWith('.jpeg') || icon.endsWith('.gif'))
        ?? session?.session?.peerMeta?.icons?.[0]

    const handlePress = () => {
        navigation.navigate('WalletConnectSettingsDetails', { session })
    }
    return (
        <PWTouchableOpacity style={styles.sessionItem} onPress={handlePress}>
            <Image source={{ uri: preferredIcon }} style={styles.icon} />
            <PWView style={styles.sessionInfo}>
                <PWView style={styles.sessionNameContainer}>
                    <Text h4>{session.session?.peerMeta?.name ?? 'Unknown'}</Text>
                    <PWBadge variant='secondary' value={`WCV${session?.version}`} />
                </PWView>
                <Text style={styles.sessionDate}>{session.lastActiveAt ? t('walletconnect.settings.last_active', { date: formatDatetime(session.lastActiveAt, undefined, 'medium') }) : t('walletconnect.settings.created_at', { date: formatDatetime(session.createdAt ?? new Date(), undefined, 'medium') })}</Text>
                <PWBadge variant={isConnected ? 'positive' : 'secondary'} value={isConnected ? t('walletconnect.settings.connected') : t('walletconnect.settings.disconnected')} />
            </PWView>
            <PWIcon style={styles.chevron} name="chevron-right" />
        </PWTouchableOpacity>
    )
}

export default WalletConnectSessionItem
