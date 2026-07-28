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
    PWButton,
    PWFlatList,
    PWIcon,
    PWImage,
    PWScreen,
    PWText,
    PWTouchableIcon,
    PWView,
} from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { QRScannerView } from '@components/QRScannerView'
import { useLanguage } from '@hooks/useLanguage'
import { useNavigationHeader } from '@hooks/useNavigationHeader'
import {
    useConnectionsSettingsScreen,
    type UnifiedConnection,
} from './useConnectionsSettingsScreen'
import { useStyles } from './styles'

type ConnectionRowProps = {
    connection: UnifiedConnection
    onRevoke: (connection: UnifiedConnection) => void
}

const ConnectionRow = ({ connection, onRevoke }: ConnectionRowProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const isWalletConnect = connection.kind === 'walletconnect'

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
                        value={t(
                            isWalletConnect
                                ? 'settings.connections.badge_wallet_connect'
                                : 'settings.connections.badge_dapp',
                        )}
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

export const ConnectionsSettingsScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { connections, isLoading, handleRevoke, keyExtractor, scannerState } =
        useConnectionsSettingsScreen()

    // Mirrors SettingsWalletConnectScreen's split entry point: the header
    // icon covers "add another connection" once the list is non-empty, and
    // the empty state's own button covers the first one — never both at once.
    useNavigationHeader({
        right:
            connections.length > 0 ? (
                <PWView testID='connections_settings_scan_button'>
                    <PWIcon
                        name='camera'
                        onPress={scannerState.open}
                    />
                </PWView>
            ) : null,
    })

    const renderItem = ({ item }: { item: UnifiedConnection }) => (
        <ConnectionRow
            connection={item}
            onRevoke={handleRevoke}
        />
    )

    return (
        <PWScreen
            scroll='never'
            testID='connections_settings_screen'
        >
            <PWFlatList
                contentContainerStyle={styles.listContainer}
                data={connections}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                ListEmptyComponent={
                    <EmptyView
                        style={styles.emptyView}
                        icon='globe'
                        isLoading={isLoading}
                        title={t('settings.connections.empty_title')}
                        body={t('settings.connections.empty_body')}
                        button={
                            <PWButton
                                title={t('walletconnect.settings.empty_button')}
                                variant='primary'
                                onPress={scannerState.open}
                                testID='connections_settings_connect_button'
                            />
                        }
                    />
                }
            />
            <QRScannerView
                isVisible={scannerState.isOpen}
                onSuccess={scannerState.close}
                onClose={scannerState.close}
                animationType='slide'
            />
        </PWScreen>
    )
}
