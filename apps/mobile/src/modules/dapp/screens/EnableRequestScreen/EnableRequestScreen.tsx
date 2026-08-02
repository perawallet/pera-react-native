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

// ARC-0027 enable-approval popup (the approval bridge opens this on
// approval.html?requestId=…). Deliberately NOT WalletConnect's ConnectionView
// — that's coupled to approveSession/WalletConnectSessionRequest/useWebView,
// none of which exist here (no WC connector, no session store). This reuses
// only the generic presentational pieces WC's view also uses
// (useSigningAccounts + AccountDisplay + PWCheckbox rows) behind a lightweight
// favicon+origin header. See useEnableRequestScreen.ts for the follow-up
// note on factoring a shared ConnectionConsentView once WalletConnect lands
// on web.
import React from 'react'
import {
    PWButton,
    PWCheckbox,
    PWFlatList,
    PWIcon,
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
        originLabel,
        requesterOrigin,
        faviconUrl,
        accounts,
        selected,
        toggle,
        canConnect,
        isLoading,
        handleConnect,
        handleCancel,
        deliveryError,
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
                        {originLabel}
                    </PWText>
                    {!!requesterOrigin && (
                        <PWView style={styles.requesterRow}>
                            <PWText
                                variant='caption'
                                style={styles.requesterOrigin}
                                testID='dapp-enable-requester-origin'
                            >
                                {t('dapp.enable.request_origin', {
                                    origin: requesterOrigin,
                                })}
                            </PWText>
                            <PWView style={styles.verifiedBadge}>
                                <PWIcon
                                    name='assets/verified'
                                    size='sm'
                                />
                                <PWText
                                    variant='caption'
                                    style={styles.verifiedBadgeText}
                                    accessibilityLabel={t(
                                        'dapp.enable.requester_verified_a11y_label',
                                    )}
                                    testID='dapp-enable-requester-verified-badge'
                                >
                                    {t('dapp.enable.requester_verified_label')}
                                </PWText>
                            </PWView>
                        </PWView>
                    )}
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
                <PWView>
                    {deliveryError && (
                        <PWText
                            variant='caption'
                            style={styles.deliveryError}
                            testID='dapp-enable-delivery-error'
                        >
                            {t('dapp.approval.delivery_failed')}
                        </PWText>
                    )}
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
