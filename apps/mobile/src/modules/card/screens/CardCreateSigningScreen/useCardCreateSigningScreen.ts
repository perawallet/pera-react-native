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
import {
    FundingType,
    useCardStore,
    type CardOwnershipProof,
} from '@perawallet/wallet-core-card'
import {
    useAllAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    useCardErrorToast,
    useEscrowCardCreation,
    useFinishCardCreation,
} from '@modules/card/hooks'
import { useRequirePinVerification } from '@modules/security'
import { useAppNavigation } from '@hooks/useAppNavigation'
import type { CardOnboardingStackParamList } from '../../routes/card-onboarding/types'

export type CardCreateStepId = 'sign' | 'create' | 'authorize'
export type CardCreateStepStatus = 'pending' | 'active' | 'done'
export type CardCreateStepRowModel = {
    id: CardCreateStepId
    stepNumber: number
    status: CardCreateStepStatus
}

type UseCardCreateSigningScreenResult = {
    steps: CardCreateStepRowModel[]
    isProceeding: boolean
    onProceed: () => void
}

export const useCardCreateSigningScreen =
    (): UseCardCreateSigningScreenResult => {
        const navigation = useAppNavigation()

        const { fundingType } =
            useRoute<
                RouteProp<CardOnboardingStackParamList, 'CardOnboardingSigning'>
            >().params

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

        const stepIds = useMemo<CardCreateStepId[]>(
            () =>
                fundingType === FundingType.Auto
                    ? ['sign', 'create', 'authorize']
                    : ['sign', 'create'],
            [fundingType],
        )

        const [currentStepIndex, setCurrentStepIndex] = useState(0)
        const [isProceeding, setIsProceeding] = useState(false)

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
                })),
            [stepIds, currentStepIndex],
        )

        // Step 2 has no separate user gate — it runs immediately once Step 1's
        // proof is in hand, per the product flow: sign → (auto) create+approve
        // → Step 3 (Auto only) or finish (Manual).
        const runCreateStep = useCallback(
            async (account: WalletAccount, proof: CardOwnershipProof) => {
                await createAndApprove(account, proof)
                if (fundingType === FundingType.Auto) {
                    setCurrentStepIndex(index => index + 1)
                } else {
                    setCurrentStepIndex(stepIds.length)
                    finish(FundingType.Manual, false)
                }
            },
            [createAndApprove, fundingType, stepIds, finish],
        )

        const runSignStep = useCallback(
            async (account: WalletAccount) => {
                if (!(await requirePinVerification())) {
                    navigation.goBack()
                    return
                }
                const proof = await signOwnership(account)
                // Only advance past 'sign' the first time — a retry of a
                // failed create step re-signs but must not fake-advance an
                // already-current later step.
                setCurrentStepIndex(index => (index === 0 ? index + 1 : index))
                await runCreateStep(account, proof)
            },
            [requirePinVerification, navigation, signOwnership, runCreateStep],
        )

        const onProceed = useCallback(() => {
            if (!connectedAccount || isProceeding) return

            const stepId = stepIds[currentStepIndex]
            if (stepId === 'authorize') {
                navigation.navigate('CardOnboardingAutoFundingSigning')
                return
            }

            const run = async () => {
                setIsProceeding(true)
                try {
                    await runSignStep(connectedAccount)
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
            stepIds,
            currentStepIndex,
            navigation,
            runSignStep,
            showError,
        ])

        return { steps, isProceeding, onProceed }
    }
