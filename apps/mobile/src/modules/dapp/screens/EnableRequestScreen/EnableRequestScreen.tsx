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

// ARC-0027 enable-approval popup (Task 4's approval bridge opens this on
// approval.html?requestId=…). Deliberately NOT WalletConnect's ConnectionView
// — that's coupled to approveSession/WalletConnectSessionRequest/useWebView,
// none of which exist here (no WC connector, no session store). This reuses
// only the generic presentational pieces WC's view also uses
// (useSigningAccounts + AccountDisplay + PWCheckbox rows) behind a lightweight
// favicon+origin header. See useEnableRequestScreen.ts for the M5 follow-up
// note on factoring a shared ConnectionConsentView once WalletConnect lands
// on web.
import React from 'react'
import {
    PWButton,
    PWCheckbox,
    PWFlatList,
    PWImage,
    PWScreen,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { FullScreenLoadingView } from '@components/FullScreenLoadingView'
import { type WalletAccount } from '@perawallet/wallet-core-accounts'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { useLanguage } from '@hooks/useLanguage'
import { useEnableRequestScreen } from './useEnableRequestScreen'
import { useStyles } from './styles'

export const EnableRequestScreen = (): React.JSX.Element => {
    const { t } = useLanguage()
    const styles = useStyles()
    const {
        origin,
        faviconUrl,
        accounts,
        selected,
        toggle,
        canConnect,
        isLoading,
        handleConnect,
        handleCancel,
    } = useEnableRequestScreen()

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

    if (isLoading) {
        return <FullScreenLoadingView />
    }

    return (
        <PWScreen
            scroll='never'
            header={
                <PWView style={styles.header}>
                    {!!faviconUrl && (
                        <PWImage
                            source={{ uri: faviconUrl }}
                            style={styles.favicon}
                        />
                    )}
                    <PWText
                        variant='body'
                        style={styles.origin}
                        testID='dapp-enable-origin'
                    >
                        {origin}
                    </PWText>
                    <PWText
                        variant='h3'
                        style={styles.title}
                    >
                        {t('dapp.enable.title')}
                    </PWText>
                    <PWText
                        variant='body'
                        style={styles.description}
                    >
                        {t('dapp.enable.description')}
                    </PWText>
                </PWView>
            }
            footer={
                <PWView style={styles.buttonContainer}>
                    <PWButton
                        variant='secondary'
                        title={t('dapp.enable.cancel_button')}
                        onPress={handleCancel}
                        style={styles.cancelButton}
                        testID='dapp-enable-cancel'
                    />
                    <PWButton
                        variant='primary'
                        title={t('dapp.enable.connect_button')}
                        onPress={handleConnect}
                        style={styles.connectButton}
                        isDisabled={!canConnect}
                        testID='dapp-enable-connect'
                    />
                </PWView>
            }
        >
            <PWFlatList
                data={accounts}
                renderItem={renderAccountRow}
                extraData={selected}
                contentContainerStyle={styles.contentContainer}
            />
        </PWScreen>
    )
}
