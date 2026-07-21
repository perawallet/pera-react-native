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
import { FundingType, useCardStore } from '@perawallet/wallet-core-card'
import {
    isLedgerAccount,
    useAllAccounts,
} from '@perawallet/wallet-core-accounts'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useRequirePinVerification } from '@modules/security'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useIsCardAutoFundingEnabled } from '@hooks/useIsCardAutoFundingEnabled'
import {
    useAuthorizeCardDelegation,
    useAutoDrawSwitch,
    useCardErrorToast,
} from '../../hooks'

export type UseSelectFundingTypeSheetResult = {
    selectedType: FundingType
    onSelectType: (type: FundingType) => void
    /** True when Auto can't be picked (flag off, or account can't sign). */
    isAutoDisabled: boolean
    /** False when the auto-funding kill-switch is off — Auto is "coming soon". */
    isAutoFundingEnabled: boolean
    /** True when the connected account is a Ledger — Auto is unsupported there. */
    isLedgerAccount: boolean
    isPending: boolean
    onApply: () => void
    onClose: () => void
}

/**
 * Owns the funding-type switch on the real AB flow: Auto posts the AutoDraw
 * LSig and submits the on-chain Killswitch `enable(card)`; Manual submits
 * `kill()`. The store is only updated after the switch succeeds, and the sheet
 * stays open on failure so the user can retry.
 */
export const useSelectFundingTypeSheet =
    (): UseSelectFundingTypeSheetResult => {
        const { t } = useLanguage()
        const { successToast } = useToast()
        const { resolve, dismiss } = useBottomSheetResult<'applied'>()
        const showError = useCardErrorToast()
        const { network } = useNetwork()

        const storedType = useCardStore(state => state.selectedFundingType)
        const connectedAddress = useCardStore(
            state => state.connectedFundingSourceAddress,
        )
        const escrowCardAddress = useCardStore(state => state.escrowCardAddress)
        const escrowCardOwner = useCardStore(state => state.escrowCardOwner)
        const escrowCardNetwork = useCardStore(state => state.escrowCardNetwork)
        const accounts = useAllAccounts()
        const connectedAccount = useMemo(
            () =>
                accounts.find(account => account.address === connectedAddress),
            [accounts, connectedAddress],
        )

        // The switch acts on the card created for THIS account on THIS network
        // (owner + network scoped, like the create mutation's reuse guard).
        const cardAddress =
            escrowCardOwner === connectedAddress &&
            escrowCardNetwork === network
                ? escrowCardAddress
                : null

        const { enableAutoDraw, disableAutoDraw, canSwitchToAuto, isPending } =
            useAutoDrawSwitch()
        const { authorizeDelegation } = useAuthorizeCardDelegation()
        const { requirePinVerification } = useRequirePinVerification()

        // Nothing stored means no delegation was ever authorized — effectively
        // Manual. Must match how the Card Details row labels the type.
        const [selectedType, setSelectedType] = useState<FundingType>(
            () => storedType ?? FundingType.Manual,
        )

        const isAutoFundingEnabled = useIsCardAutoFundingEnabled()
        const isAutoDisabled =
            !isAutoFundingEnabled ||
            (connectedAccount != null && !canSwitchToAuto(connectedAccount))
        // Ledger can never sign the AutoDraw LSig — surface a dedicated hint so
        // the user knows to switch to a signing-capable account.
        const isLedgerConnected =
            connectedAccount != null && isLedgerAccount(connectedAccount)

        // A connected account that can't sign (e.g. Ledger) can't use Auto, so
        // move the selection to Manual. Otherwise Auto stays selected but
        // disabled and Apply dead-ends trying to sign an impossible delegation.
        useEffect(() => {
            if (isAutoDisabled && selectedType === FundingType.Auto) {
                setSelectedType(FundingType.Manual)
            }
        }, [isAutoDisabled, selectedType])

        // The consent + PIN gate opens before `isPending` flips, so `isPending`
        // alone can't block a double-tap during that window.
        const isApplyingRef = useRef(false)
        const apply = useCallback(async () => {
            if (isPending || isApplyingRef.current) return
            const currentType =
                useCardStore.getState().selectedFundingType ??
                FundingType.Manual
            // No change → nothing to do. The store is written only after a
            // successful switch, so a failed prior Auto leaves it Manual and
            // re-selecting Auto is a real change (recovery).
            if (selectedType === currentType) {
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
                    // Auto authorizes a delegation bound to the escrow card;
                    // without one (never created for this account/network)
                    // there is nothing to enable. (Manual's kill() acts on the
                    // sender's own box, so it needs no card address.)
                    if (!cardAddress) {
                        await showError(null)
                        return
                    }
                    // Consent + live PIN/biometric before authorizing the grant.
                    const authorized = await authorizeDelegation(
                        connectedAccount,
                        account => enableAutoDraw(account, cardAddress),
                    )
                    if (!authorized) return
                } else {
                    // Manual revoke signs an on-chain kill() — gate on PIN.
                    if (!(await requirePinVerification())) return
                    await disableAutoDraw(connectedAccount)
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
            cardAddress,
            authorizeDelegation,
            enableAutoDraw,
            requirePinVerification,
            disableAutoDraw,
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
            isLedgerAccount: isLedgerConnected,
            isPending,
            onApply,
            onClose: dismiss,
        }
    }
