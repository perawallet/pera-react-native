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

// Consent screen for the passkey-create / passkey-get approval kinds (Task
// 4's approval bridge opens this on approval.html?requestId=…). Approving
// runs the real WebAuthn ceremony (see usePasskeyApproval) rather than just
// posting a decision, so the primary button shows a busy state while the
// authenticator core + keystore signer are doing their work.
import React from 'react'
import { PWButton, PWScreen, PWText, PWView } from '@components/core'
import { FullScreenLoadingView } from '@components/FullScreenLoadingView'
import { useLanguage } from '@hooks/useLanguage'
import { usePasskeyApproval } from './usePasskeyApproval.web'
import { useStyles } from './styles'

export const PasskeyApprovalScreen = (): React.JSX.Element => {
    const { t } = useLanguage()
    const styles = useStyles()
    const {
        isLoading,
        isCreate,
        rpId,
        userName,
        isBusy,
        error,
        approve,
        decline,
    } = usePasskeyApproval()

    if (isLoading) {
        return <FullScreenLoadingView />
    }

    return (
        <PWScreen scroll='never'>
            <PWView style={styles.container}>
                <PWText
                    variant='h3'
                    style={styles.title}
                >
                    {isCreate
                        ? t('dapp.passkey.create.title')
                        : t('dapp.passkey.get.title')}
                </PWText>
                <PWText
                    variant='body'
                    style={styles.rpId}
                    testID='dapp-passkey-rp-id'
                >
                    {rpId}
                </PWText>
                {!!userName && (
                    <PWText
                        variant='body'
                        style={styles.userName}
                        testID='dapp-passkey-user-name'
                    >
                        {userName}
                    </PWText>
                )}
                {!!error && (
                    <PWText
                        variant='body'
                        style={styles.error}
                        testID='dapp-passkey-error'
                    >
                        {error}
                    </PWText>
                )}
            </PWView>
            <PWView style={styles.buttonContainer}>
                <PWButton
                    variant='secondary'
                    title={t('dapp.passkey.decline_button')}
                    onPress={() => void decline()}
                    style={styles.declineButton}
                    isDisabled={isBusy}
                    testID='dapp-passkey-decline'
                />
                <PWButton
                    variant='primary'
                    title={t('dapp.passkey.approve_button')}
                    onPress={() => void approve()}
                    style={styles.approveButton}
                    isLoading={isBusy}
                    isDisabled={isBusy}
                    testID='dapp-passkey-approve'
                />
            </PWView>
        </PWScreen>
    )
}
