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
    AutoDrawProgramUnverifiedError,
    FundingType,
    useCardStore,
} from '@perawallet/wallet-core-card'
import {
    useAllAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    logger,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { UserRejectedSigningError } from '@perawallet/wallet-core-signing'
import { trackEvent, CardEvent } from '@analytics'
import {
    useAutoDrawSwitch,
    useCardErrorToast,
    useEscrowCardCreation,
    useFinishCardCreation,
} from '@modules/card/hooks'
import { useRequirePinVerification } from '@modules/security'
import { useAppNavigation } from '@hooks/useAppNavigation'
import type { CardOnboardingStackParamList } from '../../routes/card-onboarding/types'
import type { CardStepStatus } from '../../components/CardStepRow'

export type CardCreateStepId = 'ownership' | 'create' | 'autoFunding'
export type CardCreateStepRowModel = {
    id: CardCreateStepId
    stepNumber: number
    status: CardStepStatus
    /** The step's work is in flight; the row shows a spinner. */
    isBusy: boolean
}

type CreationStage = 'idle' | 'running' | 'failed' | 'complete'

type UseCardCreateSigningScreenResult = {
    fundingType: FundingType
    connectedAccount: Optional<WalletAccount>
    steps: CardCreateStepRowModel[]
    isRunning: boolean
    hasFailed: boolean
    /** Every step ran; the success toast and navigation are on their way. */
    isComplete: boolean
    /**
     * The card exists but Auto Funding failed to switch on, so the user can
     * keep the card on Manual instead of retrying.
     */
    canContinueWithManual: boolean
    onCreate: () => void
    onContinueWithManual: () => void
}

// A declined prompt arrives as the pipeline's typed error or as the
// fee-delegation hook's plain `Error`.
const isUserRejection = (error: unknown): boolean =>
    error instanceof UserRejectedSigningError ||
    (error instanceof Error && /user rejected/i.test(error.message))

/**
 * One tap creates the card: PIN, the ARC-60 ownership proof (reviewed on the
 * pipeline's own screen), the backend create-and-approve, and for Auto
 * Funding the delegated program signature plus the on-chain Killswitch enable
 * (reviewed on the pipeline's transaction sheet). A failure keeps the screen
 * so the same button retries; once the card exists a retry resumes at Auto
 * Funding instead of creating twice.
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
        const escrowCardAddress = useCardStore(state => state.escrowCardAddress)
        const accounts = useAllAccounts()
        const connectedAccount = useMemo(
            () =>
                accounts.find(account => account.address === connectedAddress),
            [accounts, connectedAddress],
        )

        const { signOwnership, createAndApprove } = useEscrowCardCreation()
        const { enableAutoDraw } = useAutoDrawSwitch()
        const { requirePinVerification } = useRequirePinVerification()
        const { finish } = useFinishCardCreation()
        const showCreateError = useCardErrorToast()
        const showAutoFundingError = useCardErrorToast({
            titleKey: 'peraCard.signing.auto_funding_error_title',
            bodyKey: 'peraCard.signing.auto_funding_error_body',
            shouldUseBackendMessage: false,
        })

        const isAutoFunding = fundingType === FundingType.Auto
        const stepIds = useMemo<CardCreateStepId[]>(
            () =>
                isAutoFunding
                    ? ['ownership', 'create', 'autoFunding']
                    : ['ownership', 'create'],
            [isAutoFunding],
        )

        const [stage, setStage] = useState<CreationStage>('idle')
        const [currentStepIndex, setCurrentStepIndex] = useState(0)
        // Auto Funding failed after the card was created: a retry must skip
        // the proof and the creation, and Manual is a valid way out.
        const [hasCardAwaitingAutoFunding, setHasCardAwaitingAutoFunding] =
            useState(false)

        const isRunning = stage === 'running'
        const hasFailed = stage === 'failed'
        const isComplete = stage === 'complete'
        const canContinueWithManual = hasFailed && hasCardAwaitingAutoFunding

        const steps = useMemo<CardCreateStepRowModel[]>(
            () =>
                stepIds.map((id, index) => ({
                    id,
                    stepNumber: index + 1,
                    status:
                        isComplete || index < currentStepIndex
                            ? 'done'
                            : index === currentStepIndex
                              ? 'active'
                              : 'pending',
                    isBusy: isRunning && index === currentStepIndex,
                })),
            [stepIds, currentStepIndex, isRunning, isComplete],
        )

        const runCreation = useCallback(
            async (account: WalletAccount) => {
                let step: CardCreateStepId = 'ownership'
                try {
                    let cardAddress: Nullable<string> = escrowCardAddress
                    if (!hasCardAwaitingAutoFunding) {
                        setCurrentStepIndex(0)
                        const proof = await signOwnership(account)
                        step = 'create'
                        setCurrentStepIndex(1)
                        cardAddress = (await createAndApprove(account, proof))
                            .cardAddress
                    }
                    if (!isAutoFunding) {
                        setStage('complete')
                        finish(FundingType.Manual, false)
                        return
                    }
                    step = 'autoFunding'
                    setCurrentStepIndex(2)
                    trackEvent(CardEvent.CreateFinalizeTxProceed)
                    if (cardAddress === null) {
                        throw new Error(
                            'Card address missing before Auto Funding',
                        )
                    }
                    await enableAutoDraw(account, cardAddress)
                    setStage('complete')
                    finish(FundingType.Auto, false)
                } catch (error) {
                    if (step !== 'autoFunding') {
                        setStage('failed')
                        await showCreateError(error)
                        return
                    }
                    setHasCardAwaitingAutoFunding(true)
                    if (error instanceof AutoDrawProgramUnverifiedError) {
                        // Can never succeed on retry, so degrade to Manual with
                        // the same honest copy the explicit fallback uses.
                        logger.error(
                            'AutoDraw program failed verification, degrading to Manual funding',
                            { error },
                        )
                        setStage('complete')
                        finish(FundingType.Manual, true)
                        return
                    }
                    if (!isUserRejection(error)) {
                        logger.error('Card auto-funding authorization failed', {
                            error,
                        })
                    }
                    setStage('failed')
                    await showAutoFundingError(error)
                }
            },
            [
                escrowCardAddress,
                hasCardAwaitingAutoFunding,
                signOwnership,
                createAndApprove,
                isAutoFunding,
                finish,
                enableAutoDraw,
                showCreateError,
                showAutoFundingError,
            ],
        )

        const onCreate = useCallback(() => {
            // isComplete guards the finish window (success toast + delayed
            // navigation): a second tap must not re-prompt PIN + signature.
            if (!connectedAccount || isRunning || isComplete) return
            if (!hasCardAwaitingAutoFunding) {
                trackEvent(CardEvent.CreateArbTxProceed)
            }
            const run = async () => {
                setStage('running')
                if (!(await requirePinVerification())) {
                    setStage('idle')
                    navigation.goBack()
                    return
                }
                await runCreation(connectedAccount)
            }
            void run()
        }, [
            connectedAccount,
            isRunning,
            isComplete,
            hasCardAwaitingAutoFunding,
            requirePinVerification,
            navigation,
            runCreation,
        ])

        const onContinueWithManual = useCallback(() => {
            if (!canContinueWithManual) return
            trackEvent(CardEvent.CreateFinalizeTxCancel)
            // The card was already created, so declining Auto Funding keeps
            // it on Manual rather than discarding it.
            setStage('complete')
            finish(FundingType.Manual, true)
        }, [canContinueWithManual, finish])

        return {
            fundingType,
            connectedAccount,
            steps,
            isRunning,
            hasFailed,
            isComplete,
            canContinueWithManual,
            onCreate,
            onContinueWithManual,
        }
    }
