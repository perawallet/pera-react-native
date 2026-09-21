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

import { useCallback, useMemo, useState } from 'react'
import { useRoute, type RouteProp } from '@react-navigation/native'
import { FundingType, useCardStore } from '@perawallet/wallet-core-card'
import {
    useAllAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { trackEvent, CardEvent } from '@analytics'
import {
    useCardErrorToast,
    useEscrowCardCreation,
    useFinishCardCreation,
} from '@modules/card/hooks'
import { useRequirePinVerification } from '@modules/security'
import { useAppNavigation } from '@hooks/useAppNavigation'
import type { CardOnboardingStackParamList } from '../../routes/card-onboarding/types'
import type { CardStepStatus } from '../../components/CardStepRow'

export type CardCreateStepId = 'signCreate' | 'autoFunding'
export type CardCreateStepRowModel = {
    id: CardCreateStepId
    stepNumber: number
    status: CardStepStatus
    /** The step's work is in flight; the row shows a spinner. */
    isBusy: boolean
}

type UseCardCreateSigningScreenResult = {
    fundingType: FundingType
    steps: CardCreateStepRowModel[]
    isProceeding: boolean
    /** Every step ran; the success toast and navigation are on their way. */
    isComplete: boolean
    onProceed: () => void
}

/**
 * One numbered step per signature the user actually gives. The ownership proof
 * and the card creation are a single step because one signature drives both;
 * numbering them separately made the second row complete itself untouched.
 * Auto funding is a second signature, reviewed on its own screen.
 */
export const useCardCreateSigningScreen =
    (): UseCardCreateSigningScreenResult => {
        const navigation = useAppNavigation()
        const {
            params: { fundingType },
        } =
            useRoute<
                RouteProp<CardOnboardingStackParamList, 'CardOnboardingSigning'>
            >()

        const connectedAddress = useCardStore(
            state => state.connectedFundingSourceAddress,
        )
        const accounts = useAllAccounts()
        const connectedAccount = useMemo(
            () =>
                accounts.find(account => account.address === connectedAddress),
            [accounts, connectedAddress],
        )

        const { signOwnership, createAndApprove } = useEscrowCardCreation()
        const { requirePinVerification } = useRequirePinVerification()
        const { finish } = useFinishCardCreation()
        const showError = useCardErrorToast()

        const isAutoFunding = fundingType === FundingType.Auto
        const stepIds = useMemo<CardCreateStepId[]>(
            () =>
                isAutoFunding ? ['signCreate', 'autoFunding'] : ['signCreate'],
            [isAutoFunding],
        )

        const [currentStepIndex, setCurrentStepIndex] = useState(0)
        const [isProceeding, setIsProceeding] = useState(false)
        const isComplete = currentStepIndex >= stepIds.length

        const steps = useMemo<CardCreateStepRowModel[]>(
            () =>
                stepIds.map((id, index) => ({
                    id,
                    stepNumber: index + 1,
                    status:
                        index < currentStepIndex
                            ? 'done'
                            : index === currentStepIndex
                              ? 'active'
                              : 'pending',
                    isBusy: isProceeding && index === currentStepIndex,
                })),
            [stepIds, currentStepIndex, isProceeding],
        )

        const runSignCreateStep = useCallback(
            async (account: WalletAccount) => {
                if (!(await requirePinVerification())) {
                    navigation.goBack()
                    return
                }
                const proof = await signOwnership(account)
                await createAndApprove(account, proof)
                // The card exists once this resolves, so the step only ever
                // completes as a whole: a failure leaves it active to retry.
                if (isAutoFunding) {
                    setCurrentStepIndex(1)
                    return
                }
                setCurrentStepIndex(stepIds.length)
                finish(FundingType.Manual, false)
            },
            [
                requirePinVerification,
                navigation,
                signOwnership,
                createAndApprove,
                isAutoFunding,
                stepIds,
                finish,
            ],
        )

        const onProceed = useCallback(() => {
            // isComplete guards the finish window (success toast + delayed
            // navigation): a second tap must not re-prompt PIN + signature.
            if (!connectedAccount || isProceeding || isComplete) return

            if (stepIds[currentStepIndex] === 'autoFunding') {
                trackEvent(CardEvent.CreateFinalizeTxProceed)
                navigation.navigate('CardOnboardingAutoFundingSigning')
                return
            }

            trackEvent(CardEvent.CreateArbTxProceed)
            const run = async () => {
                setIsProceeding(true)
                try {
                    await runSignCreateStep(connectedAccount)
                } catch (error) {
                    await showError(error)
                } finally {
                    setIsProceeding(false)
                }
            }
            void run()
        }, [
            connectedAccount,
            isProceeding,
            isComplete,
            stepIds,
            currentStepIndex,
            navigation,
            runSignCreateStep,
            showError,
        ])

        return { fundingType, steps, isProceeding, isComplete, onProceed }
    }
