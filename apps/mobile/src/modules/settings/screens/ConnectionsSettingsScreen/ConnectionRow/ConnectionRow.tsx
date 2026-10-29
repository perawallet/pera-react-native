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

import {
    PWBadge,
    PWIcon,
    PWImage,
    PWText,
    PWTouchableIcon,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { isSiteConnectionKind } from '../connectionsSettingsHelpers'
import { type UnifiedConnection } from '../useConnectionsSettingsScreen'
import { useStyles } from './styles'

export type ConnectionRowProps = {
    connection: UnifiedConnection
    onRevoke: (connection: UnifiedConnection) => void
}

export const ConnectionRow = ({ connection, onRevoke }: ConnectionRowProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const isWalletConnect = !isSiteConnectionKind(connection.kind)

    return (
        <PWView
            style={styles.connectionRow}
            testID={`connection_row_${connection.id}`}
        >
            {connection.iconUrl ? (
                <PWImage
                    source={{ uri: connection.iconUrl }}
                    style={styles.icon}
                />
            ) : (
                <PWIcon
                    name={isWalletConnect ? 'wallet-connect' : 'globe'}
                    style={styles.icon}
                />
            )}
            <PWView style={styles.connectionInfo}>
                <PWView style={styles.titleRow}>
                    <PWText
                        variant='h4'
                        numberOfLines={1}
                        style={styles.title}
                    >
                        {connection.title}
                    </PWText>
                    <PWBadge
                        variant='secondary'
                        value={
                            connection.badgeLabel ??
                            t(
                                isWalletConnect
                                    ? 'settings.connections.badge_wallet_connect'
                                    : 'settings.connections.badge_dapp',
                            )
                        }
                    />
                </PWView>
                <PWText
                    variant='caption'
                    numberOfLines={1}
                    style={styles.subtitle}
                >
                    {connection.subtitle}
                </PWText>
            </PWView>
            <PWTouchableIcon
                name='trash'
                variant='secondary'
                onPress={() => onRevoke(connection)}
                testID={`connection_revoke_${connection.id}`}
            />
        </PWView>
    )
}
