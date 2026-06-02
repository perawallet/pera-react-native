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
    PWButton,
    PWDialog,
    PWFlatList,
    PWIcon,
    PWText,
    PWView,
} from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { QRScannerView } from '@components/QRScannerView'
import { useLanguage } from '@hooks/useLanguage'
import { useNavigationHeader } from '@hooks/useNavigationHeader'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ConnectedAppItem } from './ConnectedAppItem'
import { useSettingsConnectedAppsScreen } from './useSettingsConnectedAppsScreen'
import type { SessionSummary } from '../../connected-apps/sessionSummary'
import { useStyles } from './styles'

const renderItem = ({ item }: { item: SessionSummary }) => {
    return <ConnectedAppItem summary={item} />
}

export const SettingsConnectedAppsScreen = () => {
    const { t } = useLanguage()
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const {
        summaries,
        hasConnections,
        scannerState,
        deleteState,
        isDeleting,
        handleDeleteAll,
    } = useSettingsConnectedAppsScreen()

    useNavigationHeader({
        title: t('settings.main.connected_apps_title'),
        right: (
            <PWView testID='connected_apps_qr_scanner_button'>
                <PWIcon
                    name='camera'
                    onPress={scannerState.open}
                />
            </PWView>
        ),
        enabled: summaries.length > 0,
    })

    return (
        <PWView
            style={styles.container}
            testID='connected_apps_screen'
        >
            <PWFlatList
                contentContainerStyle={styles.listContainer}
                data={summaries}
                keyExtractor={item => `${item.type}-${item.id}`}
                renderItem={renderItem}
                ListEmptyComponent={
                    <EmptyView
                        style={styles.emptyView}
                        icon='wallet-connect'
                        title={t('connected_apps.settings.empty_title')}
                        body={t('connected_apps.settings.empty_body')}
                        button={
                            <PWButton
                                title={t(
                                    'connected_apps.settings.empty_button',
                                )}
                                variant='primary'
                                onPress={scannerState.open}
                                testID='connected_apps_connect_button'
                            />
                        }
                    />
                }
                ListFooterComponentStyle={styles.listFooter}
                ListFooterComponent={
                    hasConnections ? (
                        <PWButton
                            title={t('connected_apps.settings.clear_all')}
                            variant='secondary'
                            onPress={deleteState.open}
                            testID='connected_apps_clear_all_button'
                        />
                    ) : null
                }
            />
            <QRScannerView
                isVisible={scannerState.isOpen}
                onSuccess={scannerState.close}
                onClose={scannerState.close}
                animationType='slide'
            />
            <PWDialog
                isVisible={deleteState.isOpen}
                onBackdropPress={deleteState.close}
            >
                <PWDialog.Title
                    title={t('connected_apps.settings.delete_all_title')}
                />
                <PWText>{t('connected_apps.settings.delete_all_body')}</PWText>
                <PWDialog.Actions>
                    <PWDialog.Button
                        title={t('common.delete.label')}
                        titleStyle={styles.deleteButtonTitle}
                        onPress={handleDeleteAll}
                        disabled={isDeleting}
                    />
                    <PWDialog.Button
                        title={t('common.cancel.label')}
                        onPress={deleteState.close}
                        disabled={isDeleting}
                    />
                </PWDialog.Actions>
            </PWDialog>
        </PWView>
    )
}
