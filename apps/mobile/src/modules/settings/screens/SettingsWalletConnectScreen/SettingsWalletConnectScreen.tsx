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

import { useCallback, useState } from 'react'
import { Dialog } from '@rneui/themed'
import type { WalletConnectConnection } from '@perawallet/wallet-core-walletconnect'
import { useWalletConnectSessionsControl } from '@modules/walletconnect/hooks/useWalletConnectSessionsControl'

import {
    PWButton,
    PWFlatList,
    PWIcon,
    PWScreen,
    PWText,
    PWView,
} from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { QRScannerView } from '@components/QRScannerView'
import { useErrorToast } from '@hooks/useErrorToast'
import { useLanguage } from '@hooks/useLanguage'
import { useModalState } from '@hooks/useModalState'
import { useNavigationHeader } from '@hooks/useNavigationHeader'
import { WalletConnectSessionItem } from '@modules/settings/components/WalletConnect/WalletConnectSessionItem'
import { useStyles } from './styles'

const renderItem = ({ item }: { item: WalletConnectConnection }) => {
    return <WalletConnectSessionItem session={item} />
}

export const SettingsWalletConnectScreen = () => {
    const { t } = useLanguage()
    // main's error surfacing, kept; this branch's connector-free hook, kept —
    // no UI surface may own a WC connector on the extension.
    const { showError } = useErrorToast()
    const { connections, deleteAllSessions } = useWalletConnectSessionsControl()
    const scannerState = useModalState()
    const deleteState = useModalState()
    const styles = useStyles()
    const [isLoading, setIsLoading] = useState(false)

    useNavigationHeader({
        title: t('settings.main.wallet_connect_title'),
        right:
            connections.length > 0 ? (
                <PWView testID='wallet_connect_qr_scanner_button'>
                    <PWIcon
                        name='camera'
                        onPress={scannerState.open}
                    />
                </PWView>
            ) : null,
    })

    const handleDeleteAll = useCallback(() => {
        setIsLoading(true)
        void deleteAllSessions()
            .catch((error: unknown) => {
                // Partial failure is possible: sessions that were killed stay
                // killed, but the store may be stale afterwards — an
                // already-killed session can reappear in the list. Cause:
                // `useWalletConnect.deleteAllSessions` runs `Promise.all` over
                // `disconnect()` calls that each filter one shared stale
                // closure, so the last resolver wins. Known follow-up work,
                // out of scope here — report, don't roll back.
                showError(error, t('common.error.title'))
            })
            .finally(() => {
                setIsLoading(false)
                deleteState.close()
            })
    }, [deleteAllSessions, deleteState, showError, t])

    return (
        <PWScreen
            scroll='never'
            testID='wallet_connect_screen'
        >
            <PWFlatList
                contentContainerStyle={styles.listContainer}
                data={connections}
                renderItem={renderItem}
                ListEmptyComponent={
                    <EmptyView
                        style={styles.emptyView}
                        icon='wallet-connect'
                        title={t('walletconnect.settings.empty_title')}
                        body={t('walletconnect.settings.empty_body')}
                        button={
                            <PWButton
                                title={t('walletconnect.settings.empty_button')}
                                variant='primary'
                                onPress={scannerState.open}
                                testID='wallet_connect_connect_button'
                            />
                        }
                    />
                }
                ListFooterComponentStyle={styles.listFooter}
                ListFooterComponent={
                    connections.length > 0 ? (
                        <PWButton
                            title={t('walletconnect.settings.clear_all')}
                            variant='secondary'
                            onPress={deleteState.open}
                            testID='wallet_connect_clear_all_button'
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
            <Dialog
                isVisible={deleteState.isOpen}
                onBackdropPress={deleteState.close}
            >
                <Dialog.Title
                    title={t('walletconnect.settings.delete_all_title')}
                />
                <PWText>{t('walletconnect.settings.delete_all_body')}</PWText>
                <Dialog.Actions>
                    <Dialog.Button
                        title={t('common.delete.label')}
                        titleStyle={styles.deleteButtonTitle}
                        onPress={handleDeleteAll}
                        disabled={isLoading}
                    />
                    <Dialog.Button
                        title={t('common.cancel.label')}
                        onPress={deleteState.close}
                        disabled={isLoading}
                    />
                </Dialog.Actions>
            </Dialog>
        </PWScreen>
    )
}
