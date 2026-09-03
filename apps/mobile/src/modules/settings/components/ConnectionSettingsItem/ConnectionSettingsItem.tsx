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

import { type ParamListBase, useNavigation } from '@react-navigation/native'
import { type NativeStackNavigationProp } from '@react-navigation/native-stack'
import { formatDatetime } from '@perawallet/wallet-core-shared'
import {
    PWBadge,
    PWIcon,
    PWImage,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { getPreferredDappIcon } from '@modules/walletconnect/utils/dapp-icon'
import type { ConnectionSettingsRow } from '@modules/settings/hooks/connectionSettingsReadModel'
import { useStyles } from './styles'

export type ConnectionSettingsItemProps = {
    connection: ConnectionSettingsRow
}

/**
 * One row of the connections settings list, over the transport-agnostic
 * `ConnectionSettingsRow`. Replaces `WalletConnectSessionItem`, which read a
 * legacy `WalletConnectConnection` straight off the old store.
 */
export const ConnectionSettingsItem = ({
    connection,
}: ConnectionSettingsItemProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()

    const handlePress = () => {
        navigation.navigate('WalletConnectSettingsDetails', { connection })
    }

    return (
        <PWTouchableOpacity
            style={styles.connectionItem}
            onPress={handlePress}
            testID='wallet_connect_session_item'
        >
            <PWImage
                source={{ uri: getPreferredDappIcon(connection.peer.icons) }}
                style={styles.icon}
            />
            <PWView style={styles.connectionInfo}>
                <PWView style={styles.connectionNameContainer}>
                    <PWText
                        variant='h4'
                        numberOfLines={1}
                        style={styles.connectionName}
                    >
                        {connection.title}
                    </PWText>
                    {connection.protocolVersion !== undefined && (
                        <PWBadge
                            variant='secondary'
                            value={`WCV${connection.protocolVersion}`}
                        />
                    )}
                </PWView>
                <PWText
                    variant='caption'
                    style={styles.connectionDate}
                >
                    {connection.lastActiveAt
                        ? t('walletconnect.settings.last_active', {
                              date: formatDatetime(
                                  new Date(connection.lastActiveAt),
                                  undefined,
                                  'medium',
                              ),
                          })
                        : t('walletconnect.settings.created_at', {
                              date: formatDatetime(
                                  new Date(connection.createdAt),
                                  undefined,
                                  'medium',
                              ),
                          })}
                </PWText>
                <PWBadge
                    variant={connection.isConnected ? 'positive' : 'secondary'}
                    value={
                        connection.isConnected
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
