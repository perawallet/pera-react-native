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

import {
    PWBadge,
    PWIcon,
    PWImage,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { WalletConnectConnection } from '@perawallet/wallet-core-walletconnect'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/language'
import { formatDatetime } from '@perawallet/wallet-core-shared'
import { ParamListBase, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'

export const WalletConnectSessionItem = ({
    session,
}: {
    session: WalletConnectConnection
}) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const isConnected = session.session?.connected

    const preferredIcon =
        session?.session?.peerMeta?.icons?.find(
            icon =>
                icon.endsWith('.png') ||
                icon.endsWith('.jpg') ||
                icon.endsWith('.jpeg') ||
                icon.endsWith('.gif'),
        ) ?? session?.session?.peerMeta?.icons?.[0]

    const handlePress = () => {
        navigation.navigate('WalletConnectSettingsDetails', { session })
    }
    return (
        <PWTouchableOpacity
            style={styles.sessionItem}
            onPress={handlePress}
        >
            <PWImage
                source={{ uri: preferredIcon }}
                style={styles.icon}
            />
            <PWView style={styles.sessionInfo}>
                <PWView style={styles.sessionNameContainer}>
                    <PWText variant='h4'>
                        {session.session?.peerMeta?.name ?? 'Unknown'}
                    </PWText>
                    <PWBadge
                        variant='secondary'
                        value={`WCV${session?.version}`}
                    />
                </PWView>
                <PWText style={styles.sessionDate}>
                    {session.lastActiveAt
                        ? t('walletconnect.settings.last_active', {
                              date: formatDatetime(
                                  session.lastActiveAt,
                                  undefined,
                                  'medium',
                              ),
                          })
                        : t('walletconnect.settings.created_at', {
                              date: formatDatetime(
                                  session.createdAt ?? new Date(),
                                  undefined,
                                  'medium',
                              ),
                          })}
                </PWText>
                <PWBadge
                    variant={isConnected ? 'positive' : 'secondary'}
                    value={
                        isConnected
                            ? t('walletconnect.settings.connected')
                            : t('walletconnect.settings.disconnected')
                    }
                />
            </PWView>
            <PWIcon
                style={styles.chevron}
                name='chevron-right'
            />
        </PWTouchableOpacity>
    )
}
