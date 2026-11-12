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
import { PWResultView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useCardOnOtherAccountScreen } from './useCardOnOtherAccountScreen'

export const CardOnOtherAccountScreen = () => {
    const { t } = useLanguage()
    const {
        isCheckingAgain,
        handleCheckAgain,
        handleLogout,
        handleOpenSupport,
    } = useCardOnOtherAccountScreen()

    return (
        <PWResultView
            variant='warning'
            icon='wallet'
            testID='card-on-other-account'
            title={t('peraCard.card_on_other_account.title')}
            body={t('peraCard.card_on_other_account.body')}
            primaryAction={{
                label: t('peraCard.card_on_other_account.check_again'),
                onPress: handleCheckAgain,
                isLoading: isCheckingAgain,
            }}
            secondaryAction={{
                label: t('peraCard.verification.logout_button'),
                onPress: handleLogout,
            }}
            linkAction={{
                label: t('peraCard.account.issuance_rejected_support'),
                onPress: handleOpenSupport,
            }}
        />
    )
}
