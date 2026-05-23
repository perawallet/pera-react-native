/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { fromCallback } from 'xstate'
import { isHardwareWalletAccount } from '@perawallet/wallet-core-accounts'
import { HardwareWalletError } from '../../pipeline/errors'
import { createHardwareStrategy } from '../../pipeline/signing/createHardwareStrategy'
import { resolveSigningAccount } from '../utils/resolveSigningAccount'
import { classifyLedgerErrorKind } from '../../utils/classifyLedgerErrorKind'
import type { SigningPhase } from '../../pipeline/types'
import type {
    HardwareSigningEvent,
    HardwareSigningInput,
} from './hardwareSigningMachine.context'

/**
 * Wraps `strategy.sign` for each group in a `fromCallback` actor so the
 * strategy's existing `SigningCallbacks` (`onPhaseChange`, `onSigningStart`,
 * `onProgress`, `onError`) can be translated into machine events the parent
 * child machine reduces into context + state value.
 *
 * The strategy is constructed inside the actor so the parent doesn't have
 * to pass it through input. The `cancelled` flag suppresses any in-flight
 * callbacks from firing after the actor is stopped mid-flight (XState calls
 * the returned cleanup function on stop, but the strategy promise may still
 * be resolving in the microtask queue).
 */
export const hardwareSignActor = fromCallback<
    HardwareSigningEvent,
    HardwareSigningInput
>(({ input, sendBack }) => {
    const { groups, allAccounts, hardwareWalletRegistry, encodeTransaction } =
        input

    const strategy = createHardwareStrategy({
        hardwareWalletRegistry,
        encodeTransaction,
    })

    let cancelled = false

    const callbacks = {
        onPhaseChange: (phase: SigningPhase) => {
            if (cancelled) return
            if (phase === 'connecting') {
                sendBack({ type: 'CONNECTING' })
            } else if (phase === 'awaiting-approval') {
                sendBack({ type: 'AWAITING_APPROVAL' })
            }
        },
        onSigningStart: () => {
            if (cancelled) return
            sendBack({ type: 'SIGNING_STARTED' })
        },
        onProgress: (current: number, total: number) => {
            if (cancelled) return
            sendBack({ type: 'PROGRESS', current, total })
        },
        onError: (error: Error) => {
            if (cancelled) return
            sendBack({
                type: 'STRATEGY_ERROR',
                error: { kind: classifyLedgerErrorKind(error), cause: error },
            })
        },
    }

    void (async () => {
        try {
            for (const group of groups) {
                const signerAccount = allAccounts.find(
                    a => a.address === group.signerAddress,
                )
                if (!signerAccount) {
                    throw new HardwareWalletError('signer_not_found')
                }
                const accountForSigning = resolveSigningAccount(
                    signerAccount,
                    group.source,
                    group.data.type,
                    allAccounts,
                )
                if (!isHardwareWalletAccount(accountForSigning)) {
                    throw new HardwareWalletError('signer_not_found')
                }
                const result = await strategy.sign(
                    group,
                    accountForSigning,
                    callbacks,
                )
                if (cancelled) return
                sendBack({ type: 'GROUP_SIGNED', result })
            }
            if (!cancelled) sendBack({ type: 'ALL_DONE' })
        } catch (err) {
            if (cancelled) return
            // onError may have already fired via strategy callbacks; this catches
            // anything thrown synchronously or escaping the strategy (e.g. the
            // signer_not_found guards above).
            const error = err instanceof Error ? err : new Error(String(err))
            sendBack({
                type: 'STRATEGY_ERROR',
                error: { kind: classifyLedgerErrorKind(error), cause: error },
            })
        }
    })()

    return () => {
        cancelled = true
    }
})
