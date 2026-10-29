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
    PWButton,
    PWFlatList,
    PWIcon,
    PWScreen,
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
import { ConnectionRow } from './ConnectionRow'

export const ConnectionsSettingsScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const {
        connections,
        isHydrated,
        handleRevoke,
        keyExtractor,
        scannerState,
        canConnect,
    } = useConnectionsSettingsScreen()

    // The header icon covers "add another" once the list is non-empty and the
    // empty state's button covers the first; never both at once.
    useNavigationHeader({
        right:
            canConnect && connections.length > 0 ? (
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
                        isLoading={!isHydrated}
                        title={t('settings.connections.empty_title')}
                        body={t('settings.connections.empty_body')}
                        button={
                            canConnect ? (
                                <PWButton
                                    title={t(
                                        'walletconnect.settings.empty_button',
                                    )}
                                    variant='primary'
                                    onPress={scannerState.open}
                                    testID='connections_settings_connect_button'
                                />
                            ) : undefined
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
