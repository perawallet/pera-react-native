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

import { fromCallback } from 'xstate'
import { isHardwareWalletAccount } from '@perawallet/wallet-core-accounts'
import { logger } from '@perawallet/wallet-core-shared'
import { HardwareWalletError } from '../../pipeline/errors'
import { createHardwareStrategy } from '../../pipeline/signing/createHardwareStrategy'
import { resolveSigningAccount } from '../utils/resolveSigningAccount'
import {
    classifyLedgerErrorKind,
    isLedgerError,
} from '../../utils/classifyLedgerErrorKind'
import type { LedgerErrorPresetKind } from '../../types/ledgerErrorPresetKind'
import type { SigningPhase } from '../../pipeline/types'
import type {
    HardwareSigningEvent,
    HardwareSigningInput,
} from './hardwareSigningMachine.context'

/**
 * Outcomes that are the user's own doing, not a fault to report.
 */
const EXPECTED_OUTCOME_KINDS: ReadonlySet<LedgerErrorPresetKind> = new Set([
    'user_rejected',
    'interrupted',
])

/**
 * The user sees the classified kind's copy; this keeps the technical detail
 * (error class, message, APDU/BLE specifics) available for diagnostics. The
 * cause's own message is included but no signable payload — the logger's
 * redaction covers keyed context, not a free-form message.
 *
 * Cancelling on the device is logged at info: `logger.error` also feeds the
 * error reporter, and a user declining a prompt is not a defect.
 */
const logHardwareError = (kind: LedgerErrorPresetKind, error: Error): void => {
    const context = {
        scope: 'hardware-signing',
        kind,
        errorName: error.name,
    }

    if (EXPECTED_OUTCOME_KINDS.has(kind)) {
        logger.info(error.message, context)
        return
    }
    logger.error(error, context)
}

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
    // Aborting on stop reaches the BLE layer: the strategy stops sending
    // APDUs and disconnects the transport, which dismisses the on-device
    // prompt. The `cancelled` flag stays as defense-in-depth against late
    // microtasks that settle before the abort propagates.
    const abortController = new AbortController()
    // The strategy reports progress per group (1..n within each group) while
    // the overlay total spans ALL groups — offset by the transactions of the
    // groups already signed so multi-group progress is monotonic.
    let progressOffset = 0

    const callbacks = {
        signal: abortController.signal,
        onPhaseChange: (phase: SigningPhase) => {
            if (cancelled) return
            if (phase === 'awaiting-approval') {
                sendBack({ type: 'AWAITING_APPROVAL' })
            }
        },
        onSigningStart: () => {
            if (cancelled) return
            sendBack({ type: 'SIGNING_STARTED' })
        },
        onProgress: (current: number, total: number) => {
            if (cancelled) return
            sendBack({
                type: 'PROGRESS',
                current: progressOffset + current,
                total,
            })
        },
        onError: (error: Error) => {
            if (cancelled) return
            // Only genuine Ledger device/transport errors drive the BLE-class
            // teardown gate. Non-device failures (e.g. ARC-60 validation
            // errors wrapped in SigningError) bypass the gate and surface as
            // an immediate inline error instead of pinning the troubleshooting
            // sheet open.
            const event = isLedgerError(error)
                ? ('STRATEGY_ERROR' as const)
                : ('NON_LEDGER_ERROR' as const)
            const kind = classifyLedgerErrorKind(error)
            logHardwareError(kind, error)
            sendBack({ type: event, error: { kind, cause: error } })
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
                // Mirrors the parent's totalTxs accounting: transaction
                // groups advance by their full length, data signs count as 1.
                progressOffset +=
                    group.data.type === 'transactions'
                        ? group.data.transactions.length
                        : 1
            }
            if (!cancelled) sendBack({ type: 'ALL_DONE' })
        } catch (err) {
            if (cancelled) return
            // onError may have already fired via strategy callbacks; this catches
            // anything thrown synchronously or escaping the strategy (e.g. the
            // signer_not_found guards above).
            const error = err instanceof Error ? err : new Error(String(err))
            const event = isLedgerError(error)
                ? ('STRATEGY_ERROR' as const)
                : ('NON_LEDGER_ERROR' as const)
            const kind = classifyLedgerErrorKind(error)
            logHardwareError(kind, error)
            sendBack({ type: event, error: { kind, cause: error } })
        }
    })()

    return () => {
        cancelled = true
        abortController.abort()
    }
})
