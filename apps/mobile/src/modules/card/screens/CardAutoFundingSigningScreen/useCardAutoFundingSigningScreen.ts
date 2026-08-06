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
import {
    AutoDrawProgramUnverifiedError,
    FundingType,
    useCardStore,
} from '@perawallet/wallet-core-card'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import { UserRejectedSigningError } from '@perawallet/wallet-core-signing'
import {
    useAutoDrawSwitch,
    useCardErrorToast,
    useFinishCardCreation,
} from '@modules/card/hooks'

/**
 * True when the failure is the user declining a signing prompt rather than
 * something going wrong. Two shapes reach here: the typed error from the
 * signing pipeline, and the fee-delegation hook's plain-`Error` rejection
 * (see useFeeDelegation; worth typing upstream).
 */
const isUserRejection = (error: Error): boolean =>
    error instanceof UserRejectedSigningError ||
    /user rejected/i.test(error.message)

export type UseCardAutoFundingSigningScreenResult = {
    isPending: boolean
    error: Nullable<Error>
    handleApprove: () => void
    handleReject: () => void
}

/**
 * Step 3 (Auto funding only): a card-module-scoped sign-approval screen for
 * the LSig delegation signature. Deliberately NOT routed through the shared
 * signing pipeline (packages/signing) — this is the only place in the app
 * that needs an LSig review screen, so it calls the program signer directly
 * and just reuses the visual layout of the pipeline's own sign-request
 * screens (slide-to-confirm + cancel).
 *
 * Approving does both legs of activation in one action — `useAutoDrawSwitch`
 * (shared with the post-onboarding funding-type switch) registers the signed
 * LSig with AB AND submits the on-chain Killswitch `enable` call, so a card
 * created with Auto funding is actually enabled, not just registered.
 */
export const useCardAutoFundingSigningScreen =
    (): UseCardAutoFundingSigningScreenResult => {
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

        const { enableAutoDraw } = useAutoDrawSwitch()
        const { finish } = useFinishCardCreation()
        // Generic authorization copy, not the raw failure: the inline notice
        // and this toast both stay human-readable, and the real error goes to
        // the logger below.
        const showError = useCardErrorToast({
            titleKey: 'peraCard.auto_funding_signing.error_title',
            bodyKey: 'peraCard.auto_funding_signing.error_body',
            shouldUseBackendMessage: false,
        })

        const [isPending, setIsPending] = useState(false)
        const [error, setError] = useState<Nullable<Error>>(null)

        const handleApprove = useCallback(() => {
            if (isPending) return

            const run = async () => {
                setIsPending(true)
                setError(null)
                try {
                    if (!connectedAccount || !escrowCardAddress) {
                        throw new Error(
                            'Missing connected account or escrow card address',
                        )
                    }
                    await enableAutoDraw(connectedAccount, escrowCardAddress)
                    finish(FundingType.Auto, false)
                } catch (err) {
                    // An unverified AutoDraw program can never succeed on
                    // retry, so "please try again" would strand the user on
                    // this screen. Degrade to Manual with the same honest copy
                    // the decline path uses (PERA-4712).
                    if (err instanceof AutoDrawProgramUnverifiedError) {
                        logger.error(
                            'AutoDraw program failed verification — degrading to Manual funding',
                            { error: err },
                        )
                        finish(FundingType.Manual, true)
                        return
                    }
                    const normalizedError =
                        err instanceof Error ? err : new Error(String(err))
                    // Declining the signing review is a normal user action, so
                    // it stays out of the error logs; everything else (algod
                    // dumps, backend 5xx) is logged in full, because the screen
                    // and toast only show short human-readable copy.
                    if (!isUserRejection(normalizedError)) {
                        logger.error('Card auto-funding authorization failed', {
                            error: err,
                        })
                    }
                    setError(normalizedError)
                    await showError(err)
                } finally {
                    setIsPending(false)
                }
            }
            void run()
        }, [
            connectedAccount,
            escrowCardAddress,
            isPending,
            enableAutoDraw,
            finish,
            showError,
        ])

        const handleReject = useCallback(() => {
            // The card was already created in Step 2 — declining here
            // degrades to Manual funding rather than discarding it.
            finish(FundingType.Manual, true)
        }, [finish])

        return { isPending, error, handleApprove, handleReject }
    }
