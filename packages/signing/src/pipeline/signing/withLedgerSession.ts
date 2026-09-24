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

import type { HardwareWalletAccount } from '@perawallet/wallet-core-accounts'
import type {
    HardwareWalletRegistry,
    HardwareWalletTransport,
    HardwareWalletTransportProvider,
} from '@perawallet/wallet-core-hardware-wallet'
import {
    LedgerAddressMismatchError,
    LedgerDeviceNotFoundError,
    LedgerDisconnectedError,
    LedgerTimeoutError,
    LEDGER_CONNECTION_TIMEOUT_MS,
} from '@perawallet/wallet-core-ledger'
import { withTimeout, type Optional } from '@perawallet/wallet-core-shared'
import type { SigningCallbacks } from '../types'
import {
    CannotSignError,
    HardwareSigningAbortedError,
    HardwareWalletError,
    SigningError,
} from '../errors'
import { isLedgerError } from '../../utils/classifyLedgerErrorKind'

/**
 * So Ledger timeouts reject typed rather than as a generic `Error`, matching
 * the discovery path's `ledgerTimeoutReason`. `operation` is a developer-facing
 * label for logs; user copy comes from the classified kind.
 */
export const ledgerTimeoutReason =
    (operation: string) =>
    (_op: string, ms: number): Error =>
        new LedgerTimeoutError(`${operation} (${ms}ms ceiling)`)

/**
 * A connect that never completes means nothing answered at that device id, so
 * it reports as "not found" rather than a timeout: the device being off or out
 * of range is overwhelmingly the cause, and "power it on and come closer" is
 * the actionable message. A genuine timeout mid-session (address verify, sign)
 * still uses `ledgerTimeoutReason` above.
 */
const connectTimeoutReason =
    (operation: string) =>
    (_op: string, ms: number): Error =>
        new LedgerDeviceNotFoundError(
            new Error(`${operation} (${ms}ms ceiling)`),
        )

/**
 * Fails a pending confirmation as soon as the link drops instead of waiting out
 * the 5-minute ceiling: the BLE transport emits `disconnect` immediately, while
 * the in-flight APDU promise simply never settles.
 *
 * `race` is a pass-through when the transport has no disconnect event, so
 * transports without one keep their previous timeout-only behavior.
 */
const createDisconnectGuard = (transport: HardwareWalletTransport) => {
    let rejectOnDisconnect: Optional<(error: Error) => void>
    const disconnected = new Promise<never>((_, reject) => {
        rejectOnDisconnect = reject
    })
    // Nothing is racing this promise between transactions in a group, and an
    // unobserved rejection there would surface as an unhandled rejection.
    disconnected.catch(() => undefined)

    const unsubscribe = transport.onDisconnect?.(() => {
        rejectOnDisconnect?.(new LedgerDisconnectedError())
    })

    return {
        race: <T>(promise: Promise<T>): Promise<T> =>
            unsubscribe ? Promise.race([promise, disconnected]) : promise,
        dispose: () => unsubscribe?.(),
    }
}

export type DisconnectGuard = ReturnType<typeof createDisconnectGuard>

export const throwIfAborted = (signal: Optional<AbortSignal>): void => {
    if (signal?.aborted) throw new HardwareSigningAbortedError()
}

/**
 * A transport arriving after the timeout race is disconnected as soon as it
 * resolves, so no open BLE link leaks — Android won't reap an orphaned one until
 * the OS times it out, which blocks the next reconnect.
 *
 * The address is verified at connect time only, matching native iOS: a multi-tx
 * session trusts the device to stay on the same account. A per-tx check is
 * future hardening.
 */
const connectAndVerify = async (
    transportProvider: HardwareWalletTransportProvider,
    deviceId: string,
    accountIndex: number,
    expectedAddress: string,
    callbacks?: SigningCallbacks,
): Promise<HardwareWalletTransport> => {
    callbacks?.onPhaseChange?.('connecting')
    const connectPromise = transportProvider.connect(deviceId)
    let transport: HardwareWalletTransport
    try {
        transport = await withTimeout(
            connectPromise,
            LEDGER_CONNECTION_TIMEOUT_MS,
            'Connect to Ledger',
            connectTimeoutReason('Connect to Ledger'),
        )
    } catch (error) {
        connectPromise
            .then(t => t.disconnect().catch(() => undefined))
            .catch(() => undefined)
        throw error
    }

    // Re-fetch the address at the stored index and compare to the account's
    // expected address. Catches silent drift when the on-device account order
    // has changed since import.
    try {
        const fetchedAccount = await withTimeout(
            transport.getAddress(accountIndex, false),
            LEDGER_CONNECTION_TIMEOUT_MS,
            'Verify Ledger address',
            ledgerTimeoutReason('Verify Ledger address'),
        )
        if (fetchedAccount.address !== expectedAddress) {
            throw new LedgerAddressMismatchError(
                expectedAddress,
                fetchedAccount.address,
            )
        }
    } catch (error) {
        // Disconnect the (successfully connected) transport before surfacing
        // the verification error — otherwise the outer finally won't see a
        // transport handle and the BLE link leaks.
        await transport.disconnect().catch(() => undefined)
        throw error
    }

    callbacks?.onPhaseChange?.('awaiting-approval')
    return transport
}

/** Returns rather than throws, so the caller can pass it to `onError` and `throw`. */
const toClassifiedError = (error: unknown): Error => {
    if (
        error instanceof CannotSignError ||
        error instanceof HardwareSigningAbortedError ||
        error instanceof HardwareWalletError ||
        isLedgerError(error)
    ) {
        return error as Error
    }
    return new SigningError(
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error : undefined,
    )
}

export type LedgerSession = {
    transport: HardwareWalletTransport
    guard: DisconnectGuard
}

export type LedgerSessionOptions = {
    registry?: HardwareWalletRegistry
    callbacks?: SigningCallbacks
}

/**
 * Connects to and verifies the account's device, runs `operation`, and tears
 * the session down whatever the outcome. Failures reach `callbacks.onError`
 * already classified; a missing transport provider throws before any session
 * exists and bypasses `onError`.
 */
export const withLedgerSession = async <T>(
    hwAccount: HardwareWalletAccount,
    options: LedgerSessionOptions,
    operation: (session: LedgerSession) => Promise<T>,
): Promise<T> => {
    const { registry, callbacks } = options

    const transportProvider = registry?.getProvider(
        hwAccount.hardwareDetails.manufacturer,
        hwAccount.hardwareDetails.transportType,
    )
    if (!transportProvider) {
        throw new HardwareWalletError('transport_unavailable')
    }

    const { deviceId, accountIndex } = hwAccount.hardwareDetails
    let transport: Optional<HardwareWalletTransport>
    let guard: Optional<DisconnectGuard>
    const signal = callbacks?.signal
    // Disconnecting settles the in-flight APDU exchange (the BLE library
    // races it against disconnect), which dismisses the on-device prompt and
    // evicts the cached transport so an immediate retry gets a fresh
    // connection instead of a TransportRaceCondition.
    const abortDisconnect = () => {
        transport?.disconnect().catch(() => undefined)
    }
    signal?.addEventListener('abort', abortDisconnect)

    try {
        throwIfAborted(signal)
        transport = await connectAndVerify(
            transportProvider,
            deviceId,
            accountIndex,
            hwAccount.address,
            callbacks,
        )
        throwIfAborted(signal)

        guard = createDisconnectGuard(transport)
        return await operation({ transport, guard })
    } catch (error) {
        const classified = toClassifiedError(error)
        callbacks?.onError?.(classified)
        throw classified
    } finally {
        signal?.removeEventListener('abort', abortDisconnect)
        // Before `disconnect()`, so our own teardown doesn't fire the
        // listener and mask the real outcome with a disconnect error.
        guard?.dispose()
        try {
            await transport?.disconnect()
        } catch {
            // Swallow disconnect errors to preserve original error
        }
    }
}
