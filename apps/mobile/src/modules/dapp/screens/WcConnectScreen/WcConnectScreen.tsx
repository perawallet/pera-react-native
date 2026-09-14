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

// approve/reject travel over the approval bridge, not a connector this surface
// may not own. Imports ConnectionApprovalView's stylesheet; the deliberate
// differences are no `inBottomSheet` on the list and the verified-requester row.
import React from 'react'
import {
    PWButton,
    PWCheckbox,
    PWFlatList,
    PWScreen,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { FullScreenLoadingView } from '@components/FullScreenLoadingView'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from '@modules/walletconnect/components/connection-approval/styles'
import { useStyles as useLocalStyles } from './styles'
import { WcConnectHeader } from './WcConnectHeader'
import { useWcConnectScreen } from './useWcConnectScreen'

export const WcConnectScreen = (): React.JSX.Element => {
    const styles = useStyles()
    const localStyles = useLocalStyles()
    const { t } = useLanguage()
    const {
        peer,
        permissions,
        requesterOrigin,
        isRequesterOriginDistinct,
        accounts,
        selected,
        toggle,
        canConnect,
        isLoading,
        isConnecting,
        handleConnect,
        handleCancel,
        deliveryError,
    } = useWcConnectScreen()

    const renderAccountRow = ({
        item,
    }: {
        item: WalletAccount
    }): React.JSX.Element => (
        <PWTouchableOpacity
            key={item.address}
            style={styles.accountItem}
            onPress={() => toggle(item.address)}
        >
            <AccountDisplay
                account={item}
                showChevron={false}
            />
            <PWCheckbox
                onPress={() => toggle(item.address)}
                checked={selected.has(item.address)}
            />
        </PWTouchableOpacity>
    )

    if (isLoading || !peer) {
        return <FullScreenLoadingView />
    }

    return (
        <PWScreen scroll='never'>
            <PWFlatList
                style={styles.container}
                contentContainerStyle={styles.contentContainer}
                data={accounts}
                renderItem={renderAccountRow}
                extraData={{ selected }}
                ListHeaderComponent={
                    <WcConnectHeader
                        peer={peer}
                        permissions={permissions}
                        requesterOrigin={requesterOrigin}
                        isRequesterOriginDistinct={isRequesterOriginDistinct}
                    />
                }
                showsVerticalScrollIndicator={false}
            />
            {deliveryError && (
                <PWText
                    variant='caption'
                    style={localStyles.deliveryError}
                    testID='wc-connect-delivery-error'
                >
                    {t('dapp.approval.delivery_failed')}
                </PWText>
            )}
            <PWView style={styles.buttonContainer}>
                <PWButton
                    variant='secondary'
                    title={t('common.cancel.label')}
                    onPress={handleCancel}
                    style={styles.cancelButton}
                    testID='wc-connect-cancel'
                />
                <PWButton
                    variant='primary'
                    title={t('common.connect.label')}
                    onPress={handleConnect}
                    style={styles.connectButton}
                    isDisabled={!canConnect}
                    isLoading={isConnecting}
                    testID='wc-connect-connect'
                />
            </PWView>
        </PWScreen>
    )
}
