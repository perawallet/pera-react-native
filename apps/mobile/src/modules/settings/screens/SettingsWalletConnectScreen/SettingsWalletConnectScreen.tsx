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

import { PWButton, PWFlatList, PWIcon, PWView } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { QRScannerView } from '@components/QRScannerView'
import { useLanguage } from '@hooks/useLanguage'
import { useModalState } from '@hooks/useModalState'
import {
    useWalletConnect,
    WalletConnectConnection,
} from '@perawallet/wallet-core-walletconnect'
import { useStyles } from './styles'
import { WalletConnectSessionItem } from '@modules/settings/components/WalletConnect/WalletConnectSessionItem'
import { Dialog, Text, useTheme } from '@rneui/themed'
import { useLayoutEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'

const renderItem = ({ item }: { item: WalletConnectConnection }) => {
    return <WalletConnectSessionItem session={item} />
}

export const SettingsWalletConnectScreen = () => {
    const { t } = useLanguage()
    const { connections, deleteAllSessions } = useWalletConnect()
    const scannerState = useModalState()
    const deleteState = useModalState()
    const styles = useStyles()
    const { theme } = useTheme()
    const [isLoading, setIsLoading] = useState(false)
    const navigation = useNavigation()

    useLayoutEffect(() => {
        if (connections.length > 0) {
            navigation.setOptions({
                title: t('settings.main.wallet_connect_title'),
                headerRight: () => (
                    <PWIcon
                        name='camera'
                        onPress={scannerState.open}
                    />
                ),
            })
        }
    }, [navigation, scannerState, connections])

    const handleDeleteAll = () => {
        setIsLoading(true)
        deleteAllSessions()
            .then(() => {
                deleteState.close()
            })
            .finally(() => {
                setIsLoading(false)
            })
    }

    return (
        <PWView style={styles.container}>
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
                <Text>{t('walletconnect.settings.delete_all_body')}</Text>
                <Dialog.Actions>
                    <Dialog.Button
                        title={t('common.delete.label')}
                        titleStyle={{ color: theme.colors.error }}
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
        </PWView>
    )
}
