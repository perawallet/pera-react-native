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

import { useCallback, useEffect, useState } from 'react'
import { FundingType, useCardStore } from '@perawallet/wallet-core-card'
import {
    isLedgerAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import { trackEvent, CardEvent } from '@analytics'
import { canAutoFund, useEscrowCardCreation } from '@modules/card/hooks'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useIsCardAutoFundingEnabled } from '@hooks/useIsCardAutoFundingEnabled'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'

export type UseStatusFundingTypeResult = {
    /** The funding type chosen on the final step (defaults to Auto). */
    selectedFundingType: FundingType
    /** Selects a funding type: local state until "Create Pera Card" commits it. */
    handleSelectFundingType: (type: FundingType) => void
    /** True when Auto can't be picked (kill-switch off, or account can't sign). */
    isAutoFundingUnavailable: boolean
    /** False when the auto-funding kill-switch is off: Auto is "coming soon". */
    isAutoFundingEnabled: boolean
    /** True when the connected account is a Ledger: Auto is unsupported there. */
    isConnectedLedger: boolean
    /** Navigates to the signing screen, which runs the actual create sequence. */
    handleCreatePeraCard: () => void
}

/** The checklist's funding-type row and its Create Pera Card action. */
export const useStatusFundingType = (
    scope: ChainScope,
    connectedAccount: Optional<WalletAccount>,
): UseStatusFundingTypeResult => {
    const { t } = useLanguage()
    const navigation = useAppNavigation()
    const { errorToast } = useToast()
    // Funding type is chosen locally and committed by the creation of an lsig.
    // Seed from the persisted choice (so a prior selection survives a
    // re-entry/cold resume); default to Auto to match the design.
    const [selectedFundingType, setSelectedFundingType] = useState<FundingType>(
        () => useCardStore.getState().selectedFundingType ?? FundingType.Auto,
    )
    const handleSelectFundingType = useCallback((type: FundingType) => {
        trackEvent(
            type === FundingType.Auto
                ? CardEvent.CreateCardAutoFunding
                : CardEvent.CreateCardManualFunding,
        )
        setSelectedFundingType(type)
    }, [])

    // Only `canCreateCard` is needed here: the actual creation sequence
    // (sign → create → optional LSig) now runs on CardCreateSigningScreen.
    const { canCreateCard } = useEscrowCardCreation()
    const isAutoFundingEnabled = useIsCardAutoFundingEnabled()
    // Auto availability keys off LSig signing, NOT card creation: a Ledger
    // creates a card but can never sign the AutoDraw LSig.
    const isConnectedLedger =
        connectedAccount != null && isLedgerAccount(connectedAccount)
    const isAutoFundingUnavailable =
        !isAutoFundingEnabled ||
        (connectedAccount != null && !canAutoFund(connectedAccount, scope))

    // A connected account that can't sign an LSig (e.g. Ledger) can't use Auto, so
    // fall back to Manual. Without this the Auto option stays selected but
    // disabled, and "Create Pera Card" dead-ends trying to sign a
    // delegation the account can't produce.
    useEffect(() => {
        if (
            isAutoFundingUnavailable &&
            selectedFundingType === FundingType.Auto
        ) {
            setSelectedFundingType(FundingType.Manual)
        }
    }, [isAutoFundingUnavailable, selectedFundingType])

    // Both paths sign (ARC-60 for creation; +LSig for Auto), so a
    // signing-capable connected account is required before handing off to
    // the signing screen, which runs the actual create sequence.
    const handleCreatePeraCard = useCallback(() => {
        trackEvent(CardEvent.CreateCard)
        if (!connectedAccount || !canCreateCard(connectedAccount)) {
            errorToast(
                t('peraCard.setup_status.create_card_account_error_title'),
                t('peraCard.setup_status.create_card_account_error_body'),
            )
            return
        }
        navigation.navigate('CardOnboardingSigning', {
            fundingType: selectedFundingType,
        })
    }, [
        connectedAccount,
        canCreateCard,
        errorToast,
        navigation,
        selectedFundingType,
        t,
    ])

    return {
        selectedFundingType,
        handleSelectFundingType,
        isAutoFundingUnavailable,
        isAutoFundingEnabled,
        isConnectedLedger,
        handleCreatePeraCard,
    }
}
