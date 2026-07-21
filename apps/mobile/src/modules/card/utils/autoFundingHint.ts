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

type Translate = (key: string) => string

type AutoFundingHintParams = {
    /** False when the kill-switch is off — Auto is "coming soon". */
    isAutoFundingEnabled: boolean
    /** True when Auto is disabled for a reason other than the flag (can't sign). */
    isAutoUnavailable: boolean
    /**
     * True when the connected account is a Ledger. Ledger can never sign the
     * AutoDraw LSig, so it gets a dedicated "switch accounts" message instead of
     * the generic can't-sign one.
     */
    isLedgerAccount?: boolean
    /** Shown when Auto is enabled and available (e.g. the per-tx limit hint). */
    fallback?: string
}

/**
 * The Auto option's hint, shared by the onboarding row and the Card Details
 * sheet so the flag/unavailable priority can't drift between them.
 */
export const resolveAutoFundingHint = (
    t: Translate,
    {
        isAutoFundingEnabled,
        isAutoUnavailable,
        isLedgerAccount = false,
        fallback,
    }: AutoFundingHintParams,
): string | undefined => {
    if (!isAutoFundingEnabled) {
        return t('peraCard.account.funding_type_auto_coming_soon_hint')
    }
    if (isAutoUnavailable) {
        return isLedgerAccount
            ? t('peraCard.account.funding_type_auto_ledger_hint')
            : t('peraCard.account.funding_type_auto_unavailable_hint')
    }
    return fallback
}
