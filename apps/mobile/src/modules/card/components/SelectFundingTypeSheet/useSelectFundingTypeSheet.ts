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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    FundingType,
    useCardExternalWalletsQuery,
    useCardStore,
} from '@perawallet/wallet-core-card'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useIsCardAutoFundingEnabled } from '@hooks/useIsCardAutoFundingEnabled'
import {
    useAuthorizeCardDelegation,
    useCardErrorToast,
    useCardFundingDelegation,
} from '../../hooks'

export type UseSelectFundingTypeSheetResult = {
    selectedType: FundingType
    onSelectType: (type: FundingType) => void
    /** True when Auto can't be picked (flag off, or account can't sign). */
    isAutoDisabled: boolean
    /** False when the auto-funding kill-switch is off — Auto is "coming soon". */
    isAutoFundingEnabled: boolean
    isPending: boolean
    onApply: () => void
    onClose: () => void
}

/**
 * Owns the funding-type switch: Auto signs + posts a new delegation, Manual
 * cancels it (allowance 0). The store is only updated after Baanx accepts, and
 * the sheet stays open on failure so the user can retry.
 */
export const useSelectFundingTypeSheet =
    (): UseSelectFundingTypeSheetResult => {
        const { t } = useLanguage()
        const { successToast } = useToast()
        const { resolve, dismiss } = useBottomSheetResult<'applied'>()
        const showError = useCardErrorToast()

        const storedType = useCardStore(state => state.selectedFundingType)
        const connectedAddress = useCardStore(
            state => state.connectedFundingSourceAddress,
        )
        const accounts = useAllAccounts()
        const connectedAccount = useMemo(
            () =>
                accounts.find(account => account.address === connectedAddress),
            [accounts, connectedAddress],
        )

        const { delegateTo, cancelDelegation, isPending, canDelegate } =
            useCardFundingDelegation()
        const { authorizeDelegation } = useAuthorizeCardDelegation()
        const { hasActiveDelegation } = useCardExternalWalletsQuery({
            address: connectedAddress,
        })

        // Nothing stored means no delegation was ever signed — effectively
        // Manual. Must match how the Card Details row labels the type.
        const [selectedType, setSelectedType] = useState<FundingType>(
            () => storedType ?? FundingType.Manual,
        )

        const isAutoFundingEnabled = useIsCardAutoFundingEnabled()
        const isAutoDisabled =
            !isAutoFundingEnabled ||
            (connectedAccount != null && !canDelegate(connectedAccount))

        // A connected account that can't sign (e.g. Ledger) can't use Auto, so
        // move the selection to Manual. Otherwise Auto stays selected but
        // disabled and Apply dead-ends trying to sign an impossible delegation.
        useEffect(() => {
            if (isAutoDisabled && selectedType === FundingType.Auto) {
                setSelectedType(FundingType.Manual)
            }
        }, [isAutoDisabled, selectedType])

        // The consent + PIN gate opens before the mutation flips `isPending`,
        // so `isPending` alone can't block a double-tap during that window.
        const isApplyingRef = useRef(false)
        const apply = useCallback(async () => {
            if (isPending || isApplyingRef.current) return
            const currentType =
                useCardStore.getState().selectedFundingType ??
                FundingType.Manual
            // No change → nothing to sign or post. Auto only counts as
            // unchanged while a delegation is live, so re-applying it can
            // recover a failed redelegation.
            const isUnchanged =
                selectedType === currentType &&
                (selectedType === FundingType.Manual || hasActiveDelegation)
            if (isUnchanged) {
                dismiss()
                return
            }
            if (!connectedAccount) {
                await showError(null)
                return
            }
            isApplyingRef.current = true
            try {
                if (selectedType === FundingType.Auto) {
                    // Consent + live PIN/biometric before signing the grant.
                    const authorized = await authorizeDelegation(
                        connectedAccount,
                        delegateTo,
                    )
                    if (!authorized) return
                } else if (canDelegate(connectedAccount)) {
                    // Manual: zero any live delegation. A non-signing account
                    // (e.g. Ledger) can't hold one, so there's nothing to sign.
                    await cancelDelegation(connectedAccount)
                }
                useCardStore.getState().setSelectedFundingType(selectedType)
                successToast(
                    t('peraCard.account.funding_type_updated_title'),
                    t('peraCard.account.funding_type_updated_body'),
                )
                resolve('applied')
            } catch (error) {
                await showError(error)
            } finally {
                isApplyingRef.current = false
            }
        }, [
            isPending,
            selectedType,
            connectedAccount,
            hasActiveDelegation,
            canDelegate,
            delegateTo,
            authorizeDelegation,
            cancelDelegation,
            successToast,
            resolve,
            dismiss,
            showError,
            t,
        ])

        const onApply = useCallback(() => {
            void apply()
        }, [apply])

        return {
            selectedType,
            onSelectType: setSelectedType,
            isAutoDisabled,
            isAutoFundingEnabled,
            isPending,
            onApply,
            onClose: dismiss,
        }
    }
