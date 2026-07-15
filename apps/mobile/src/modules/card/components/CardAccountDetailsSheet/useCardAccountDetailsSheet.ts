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

import {
    VerificationState,
    useCardUserQuery,
    useRegistrationSettingsQuery,
} from '@perawallet/wallet-core-card'
import { useLanguage } from '@hooks/useLanguage'
import { getCountryName } from '../../utils/getCountryName'

/** KYC presentation tone — drives the status color in the sheet. */
export type KycTone = 'verified' | 'pending' | 'rejected' | 'unverified'

type AccountDetail = {
    /** Stable id (also the React key); not user-facing. */
    key: string
    label: string
    value: string
}

type UseCardAccountDetailsSheetResult = {
    isLoading: boolean
    details: AccountDetail[]
    kyc: { label: string; tone: KycTone }
}

const KYC_BY_STATE: Record<
    VerificationState,
    { labelKey: string; tone: KycTone }
> = {
    [VerificationState.Verified]: {
        labelKey: 'peraCard.account_details.kyc_verified',
        tone: 'verified',
    },
    [VerificationState.Pending]: {
        labelKey: 'peraCard.account_details.kyc_pending',
        tone: 'pending',
    },
    [VerificationState.Rejected]: {
        labelKey: 'peraCard.account_details.kyc_rejected',
        tone: 'rejected',
    },
    [VerificationState.Unverified]: {
        labelKey: 'peraCard.account_details.kyc_unverified',
        tone: 'unverified',
    },
}

export const useCardAccountDetailsSheet =
    (): UseCardAccountDetailsSheetResult => {
        const { t } = useLanguage()
        const { data: user, isLoading } = useCardUserQuery()
        // Cached, long-lived list — used only to resolve the country code to a
        // name; the sheet doesn't block on it (falls back to the code).
        const { data: settings } = useRegistrationSettingsQuery()

        const unavailable = t('peraCard.account_details.value_unavailable')
        const fullName =
            [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
            unavailable
        // `||` (not `??`) so an empty-string field falls back to the
        // placeholder, consistent with the full-name row.
        const country =
            getCountryName(
                user?.countryOfResidence || undefined,
                settings?.countries ?? [],
            ) ||
            user?.countryOfResidence ||
            unavailable

        const details: AccountDetail[] = [
            {
                key: 'full_name',
                label: t('peraCard.account_details.full_name'),
                value: fullName,
            },
            {
                key: 'email',
                label: t('peraCard.account_details.email'),
                value: user?.email || unavailable,
            },
            {
                key: 'phone',
                label: t('peraCard.account_details.phone'),
                value: user?.phoneNumber || unavailable,
            },
            {
                key: 'country',
                label: t('peraCard.account_details.country'),
                value: country,
            },
        ]

        const kycEntry =
            KYC_BY_STATE[
                user?.verificationState ?? VerificationState.Unverified
            ]

        return {
            isLoading,
            details,
            kyc: { label: t(kycEntry.labelKey), tone: kycEntry.tone },
        }
    }
