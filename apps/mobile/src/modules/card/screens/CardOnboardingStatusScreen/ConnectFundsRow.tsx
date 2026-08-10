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

import React from 'react'
import {
    truncateAlgorandAddress,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { type WalletAccount } from '@perawallet/wallet-core-accounts'
import { PWButton, PWText, PWView } from '@components/core'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { useLanguage } from '@hooks/useLanguage'
import { StatusChecklistRow } from './StatusChecklistRow'
import { useStyles } from './styles'

type ConnectFundsRowProps = {
    isFundsConnected: boolean
    isRegistrationComplete: boolean
    connectedAccount: Optional<WalletAccount>
    connectedAddress: Nullable<string>
    onConnectAccount: (source: 'connect' | 'change') => void
}

/** Checklist row 3 — "Connect Funds": inactive → active → connected. */
export const ConnectFundsRow = ({
    isFundsConnected,
    isRegistrationComplete,
    connectedAccount,
    connectedAddress,
    onConnectAccount,
}: ConnectFundsRowProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const title = t('peraCard.setup_status.connect_funds_title')

    if (isFundsConnected) {
        return (
            <StatusChecklistRow
                icon='check'
                iconVariant='positive'
                title={title}
                testID='card-onboarding-status-connect-funds'
            >
                <PWView style={styles.connectedCard}>
                    {connectedAccount ? (
                        <AccountDisplay
                            account={connectedAccount}
                            showChevron={false}
                            noBorder
                            iconProps={{ size: 'sm' }}
                            style={styles.connectedAccountInfo}
                            testID='card-onboarding-status-connected-account'
                        />
                    ) : (
                        <PWText
                            variant='body'
                            weight={400}
                            style={styles.connectedAccountInfo}
                            testID='card-onboarding-status-connected-account'
                        >
                            {truncateAlgorandAddress(connectedAddress ?? '')}
                        </PWText>
                    )}
                    <PWText
                        variant='linkPositive'
                        onPress={() => onConnectAccount('change')}
                        testID='card-onboarding-status-change-account'
                    >
                        {t('peraCard.connect_account.change')}
                    </PWText>
                </PWView>
            </StatusChecklistRow>
        )
    }

    if (isRegistrationComplete) {
        return (
            <StatusChecklistRow
                icon='wallet'
                iconVariant='primary'
                title={title}
                body={t('peraCard.setup_status.connect_funds_body')}
                testID='card-onboarding-status-connect-funds'
            >
                <PWButton
                    variant='primary'
                    title={t('peraCard.setup_status.connect_funds_button')}
                    onPress={() => onConnectAccount('connect')}
                    style={styles.detailsButton}
                    testID='card-onboarding-status-connect-cta'
                />
            </StatusChecklistRow>
        )
    }

    return (
        <StatusChecklistRow
            icon='wallet'
            iconVariant='secondary'
            isInactive
            title={title}
            testID='card-onboarding-status-connect-funds'
        />
    )
}
