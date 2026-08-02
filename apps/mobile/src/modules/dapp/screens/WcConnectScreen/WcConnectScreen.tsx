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

// The extension's WalletConnect connect-approval surface: the web twin of
// @modules/walletconnect's ConnectionView. Replaces the ARC-0027
// EnableRequestScreen that previously served `wc-connect` requests, which asked
// the same question with a different (and much plainer) face.
//
// A twin rather than a reuse, by owner decision (2026-07-30) — phase one leaves
// the mobile component alone and a later phase factors both onto one shared
// consent view. What forces a twin today: ConnectionView approves through
// `useWalletConnect`'s own approveSession, and no extension surface may own a
// connector (offscreen does, enforced by webConnectorOwnership.test.ts — whose
// scan is a literal source match, so spelling that call form out even in a
// comment would flag this file). Approve/reject here travel back over the
// approval bridge instead.
//
// VISUAL FIDELITY comes from importing ConnectionView's own stylesheet — not
// from copied values — and from keeping this element tree aligned with it. The
// two differences are deliberate: no `inBottomSheet` on the list (this is a
// top-level approval document, not a sheet) and the verified-requester row in
// the header. __tests__/visualFidelity.spec.ts fails if the trees drift.
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
import { type WalletAccount } from '@perawallet/wallet-core-accounts'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from '@modules/walletconnect/components/ConnectionView/styles'
// Same split as WcConnectHeader: shared visuals come from ConnectionView's
// stylesheet, and only what mobile has no counterpart for lives locally.
import { useStyles as useLocalStyles } from './styles'
import { WcConnectHeader } from './WcConnectHeader'
import { useWcConnectScreen } from './useWcConnectScreen'

export const WcConnectScreen = (): React.JSX.Element => {
    const styles = useStyles()
    const localStyles = useLocalStyles()
    const { t } = useLanguage()
    const {
        request,
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

    if (isLoading || !request) {
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
                        request={request}
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
