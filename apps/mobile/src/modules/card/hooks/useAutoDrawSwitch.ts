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

import { useCallback, useState } from 'react'
import {
    DEFAULT_CARD_CURRENCY,
    submitAutoDrawDelegation,
    useKillswitchAutoDraw,
    isKillswitchConfigured,
} from '@perawallet/wallet-core-card'
import { type WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    encodeDelegatedLsigAccount,
    useProgramSigner,
    useSignAndSubmitGroup,
} from '@perawallet/wallet-core-signing'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { logger } from '@perawallet/wallet-core-shared'
import { canAutoFund } from './useCardFundingSourcePicker'

export type UseAutoDrawSwitchResult = {
    /**
     * Turns auto-funding ON for an already-created card: registers the signed
     * AutoDraw LSig with AB, then submits the on-chain Killswitch `enable(card)`
     * (skipped when the Killswitch app isn't configured yet, e.g. dev builds).
     */
    enableAutoDraw: (
        account: WalletAccount,
        cardAddress: string,
    ) => Promise<void>
    /** Turns auto-funding OFF: submits the on-chain Killswitch `kill()`. */
    disableAutoDraw: (account: WalletAccount) => Promise<void>
    /** Local-key only — Ledger/watch/rekeyed can't sign the delegated LSig. */
    canSwitchToAuto: (account: WalletAccount) => boolean
    isPending: boolean
}

/**
 * Orchestrates the post-onboarding funding-type switch against the real AB
 * flow: the AutoDraw LSig (compile → sign → POST, shared with onboarding) plus
 * the on-chain Killswitch enable/kill that actually activates/deactivates
 * auto-draw. Keeps the card package signing-agnostic — the program signer is
 * injected here.
 */
export const useAutoDrawSwitch = (): UseAutoDrawSwitchResult => {
    const { network } = useNetwork()
    const { signProgram } = useProgramSigner()
    const { buildEnable, buildKill, isAutoDrawEnabled } =
        useKillswitchAutoDraw()
    const { submit } = useSignAndSubmitGroup()
    const [isPending, setIsPending] = useState(false)

    const canSwitchToAuto = useCallback(
        (account: WalletAccount) => canAutoFund(account),
        [],
    )

    const enableAutoDraw = useCallback(
        async (account: WalletAccount, cardAddress: string): Promise<void> => {
            setIsPending(true)
            try {
                // 1. Register the signed LSig with AB (its own ownership proof).
                await submitAutoDrawDelegation({
                    network,
                    token: DEFAULT_CARD_CURRENCY.toLowerCase(),
                    address: account.address,
                    cardAddress,
                    signLsigProgram: async program =>
                        encodeDelegatedLsigAccount(
                            program,
                            await signProgram(account, program),
                            account.address,
                        ),
                })

                // 2. Activate on-chain. Skipped until AB's Killswitch app is
                // configured (dev builds) — the LSig POST still exercises AB.
                if (!isKillswitchConfigured(network)) {
                    logger.warn(
                        'Killswitch not configured — skipping on-chain enable',
                    )
                    return
                }
                // Pre-check instead of tolerating ALREADY_ENABLED: the revert
                // fires during the resource-population simulate as an opaque
                // plain Error, so it can't be reliably detected after the
                // fact. Already enabled == the retry/recovery case — done.
                // (A concurrent enable between check and submit still reverts;
                // that surfaces as a retryable error and the retry no-ops.)
                if (await isAutoDrawEnabled({ sender: account.address })) {
                    return
                }
                const txns = await buildEnable({
                    sender: account.address,
                    cardAddress,
                })
                await submit({
                    unsignedTxs: txns,
                    source: {
                        name: 'card-autodraw-enable',
                        description: 'Enable auto funding',
                    },
                })
            } finally {
                setIsPending(false)
            }
        },
        [network, signProgram, isAutoDrawEnabled, buildEnable, submit],
    )

    const disableAutoDraw = useCallback(
        async (account: WalletAccount): Promise<void> => {
            if (!isKillswitchConfigured(network)) {
                logger.warn(
                    'Killswitch not configured — skipping on-chain kill',
                )
                return
            }
            setIsPending(true)
            try {
                // Pre-check instead of tolerating ALREADY_DISABLED (same
                // simulate-revert opacity as enable). No box == nothing to
                // kill: covers the retry case AND a persisted-Auto state whose
                // on-chain enable never happened (e.g. Auto chosen during
                // onboarding, which only registers the LSig) — switching to
                // Manual must succeed there, not dead-end on a revert.
                if (!(await isAutoDrawEnabled({ sender: account.address }))) {
                    return
                }
                const txns = await buildKill({ sender: account.address })
                await submit({
                    unsignedTxs: txns,
                    source: {
                        name: 'card-autodraw-disable',
                        description: 'Turn off auto funding',
                    },
                })
            } finally {
                setIsPending(false)
            }
        },
        [network, isAutoDrawEnabled, buildKill, submit],
    )

    return { enableAutoDraw, disableAutoDraw, canSwitchToAuto, isPending }
}
