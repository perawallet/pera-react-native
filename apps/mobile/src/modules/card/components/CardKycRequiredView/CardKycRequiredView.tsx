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

import { PWInfoView } from '@components/core'
import ShieldWarningImage from '@assets/icons/shield-warning.svg'
import { useLanguage } from '@hooks/useLanguage'

type CardKycRequiredViewProps = {
    /** Sends the user back to the identity-verification step. */
    onVerify: () => void
}

/**
 * Shown in place of a registration form when the onboarding record's identity
 * check isn't far enough along for Baanx to accept the step. Replaces the form
 * outright rather than disabling it: the fields are typically empty at this
 * point, so a dead form explains nothing.
 *
 * Navigation is injected so both the personal-details and address steps can
 * share this.
 */
export const CardKycRequiredView = ({ onVerify }: CardKycRequiredViewProps) => {
    const { t } = useLanguage()

    return (
        <PWInfoView
            illustration={ShieldWarningImage}
            title={t('peraCard.kyc_required.title')}
            body={t('peraCard.kyc_required.body')}
            primaryAction={{
                label: t('peraCard.kyc_required.verify_button'),
                onPress: onVerify,
                testID: 'card-kyc-required-verify',
            }}
            testID='card-kyc-required'
        />
    )
}
