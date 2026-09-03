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
    compileAutoDrawProgram,
    postDelegatorLsig,
    resolveEscrowChainConfig,
    useKillswitchAutoDraw,
    isKillswitchConfigured,
} from '@perawallet/wallet-core-card'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    encodeDelegatedLsigAccount,
    useProgramSigner,
    useSignAndSubmitGroup,
} from '@perawallet/wallet-core-signing'
import { useFeeDelegation } from '@perawallet/wallet-core-fee-delegation'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { encodeToBase64, logger } from '@perawallet/wallet-core-shared'
import { canAutoFund } from './useCardFundingSourcePicker'

export type UseAutoDrawSwitchResult = {
    /**
     * Turns auto-funding ON for an already-created card: registers the signed
     * AutoDraw LSig with AB, then submits the on-chain Killswitch
     * `enable(card, asset)` via the Pera backend's fee-delegation endpoint.
     * The sponsor covers the group's fees (inner call included) and tops the
     * account up to min balance, so the funding account needs no ALGO of its
     * own; the accounts-box MBR is funded by the Killswitch app itself.
     * Skipped when the Killswitch app isn't configured yet (e.g. dev builds).
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
    const { submitWithFeeDelegation } = useFeeDelegation()
    const [isPending, setIsPending] = useState(false)

    const canSwitchToAuto = useCallback(
        (account: WalletAccount) => canAutoFund(account),
        [],
    )

    const enableAutoDraw = useCallback(
        async (account: WalletAccount, cardAddress: string): Promise<void> => {
            setIsPending(true)
            try {
                // 1. Register the signed LSig with AB (its own ownership
                // proof): compile the pinned AutoDraw program, sign it with the
                // funding account's key, then POST the delegated LogicSig —
                // the same compile → sign → post the onboarding flow uses
                // (useCreateEscrowCardMutation / useEscrowCardCreation).
                const program = await compileAutoDrawProgram({ network })
                const lsigBytes = encodeDelegatedLsigAccount(
                    program,
                    await signProgram(account, program),
                    account.address,
                )
                await postDelegatorLsig({
                    network,
                    token: DEFAULT_CARD_CURRENCY.toLowerCase(),
                    delegatorAddress: account.address,
                    lsigBytes: encodeToBase64(lsigBytes),
                    cardAddress,
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
                const { assetId } = resolveEscrowChainConfig(network)
                if (
                    await isAutoDrawEnabled({
                        sender: account.address,
                        asset: assetId,
                    })
                ) {
                    return
                }
                const txns = await buildEnable({
                    sender: account.address,
                    cardAddress,
                    asset: assetId,
                })
                // Fee-delegated: the sponsor covers the group's fees (the
                // backend simulates the group, so enable's inner getCardData
                // call is priced in) and tops the account up to min balance,
                // so the funding account needs no ALGO. The accounts-box MBR
                // is funded by the Killswitch app account, not the sponsor.
                await submitWithFeeDelegation({
                    account: account.address,
                    transactions: txns,
                    includeAssetOptInMbr: true,
                    sourceMetadata: {
                        name: 'card-autodraw-enable',
                        description: 'Enable auto funding',
                    },
                })
            } finally {
                setIsPending(false)
            }
        },
        [
            network,
            signProgram,
            isAutoDrawEnabled,
            buildEnable,
            submitWithFeeDelegation,
        ],
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
                const { assetId } = resolveEscrowChainConfig(network)
                if (
                    !(await isAutoDrawEnabled({
                        sender: account.address,
                        asset: assetId,
                    }))
                ) {
                    return
                }
                const txns = await buildKill({
                    sender: account.address,
                    asset: assetId,
                })
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
