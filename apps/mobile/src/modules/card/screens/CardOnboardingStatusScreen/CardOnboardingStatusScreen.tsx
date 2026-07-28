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
import { PWScreen, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useCardOnboardingStatusScreen } from './useCardOnboardingStatusScreen'
import { DocumentsRow } from './DocumentsRow'
import { EnterDetailsRow } from './EnterDetailsRow'
import { ConnectFundsRow } from './ConnectFundsRow'
import { SelectFundingTypeRow } from './SelectFundingTypeRow'
import { StatusFooter } from './StatusFooter'
import { useStyles } from './styles'

export const CardOnboardingStatusScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const {
        documentsState,
        isKycSubmitted,
        isRegistrationComplete,
        isFundsConnected,
        connectedAccount,
        connectedAddress,
        selectedFundingType,
        handleSelectFundingType,
        isAutoFundingUnavailable,
        isAutoFundingEnabled,
        isLedgerAccount,
        handleCreatePeraCard,
        handleEnterDetails,
        handleVerifyIdentity,
        handleRetryStatus,
        handleConnectAccount,
        handleLogout,
        handleOpenSupport,
    } = useCardOnboardingStatusScreen()

    return (
        <PWScreen
            testID='card-onboarding-status'
            footer={
                <StatusFooter
                    isFundsConnected={isFundsConnected}
                    onCreatePeraCard={handleCreatePeraCard}
                    onLogout={handleLogout}
                    onOpenSupport={handleOpenSupport}
                />
            }
        >
            <PWView style={styles.content}>
                <PWText variant='h1'>{t('peraCard.setup_status.title')}</PWText>

                <PWView style={styles.checklist}>
                    <DocumentsRow
                        documentsState={documentsState}
                        onRetry={handleRetryStatus}
                        onVerify={handleVerifyIdentity}
                    />
                    <EnterDetailsRow
                        isRegistrationComplete={isRegistrationComplete}
                        isKycSubmitted={isKycSubmitted}
                        onEnterDetails={handleEnterDetails}
                    />
                    <ConnectFundsRow
                        isFundsConnected={isFundsConnected}
                        isRegistrationComplete={isRegistrationComplete}
                        connectedAccount={connectedAccount}
                        connectedAddress={connectedAddress}
                        onConnectAccount={handleConnectAccount}
                    />
                    <SelectFundingTypeRow
                        isFundsConnected={isFundsConnected}
                        selectedFundingType={selectedFundingType}
                        onSelectFundingType={handleSelectFundingType}
                        isAutoFundingUnavailable={isAutoFundingUnavailable}
                        isAutoFundingEnabled={isAutoFundingEnabled}
                        isLedgerAccount={isLedgerAccount}
                    />
                </PWView>
            </PWView>
        </PWScreen>
    )
}
