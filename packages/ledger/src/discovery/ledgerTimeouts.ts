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

import { withTimeout } from '@perawallet/wallet-core-shared'
import {
    LEDGER_CONFIRMATION_TIMEOUT_MS,
    LEDGER_CONNECTION_TIMEOUT_MS,
    LedgerTimeoutError,
} from '@perawallet/wallet-extension-ledger-react-native/protocol'

/**
 * Factory for the `rejectWith` callback of the shared `withTimeout` helper,
 * so Ledger call sites reject with a typed `LedgerTimeoutError` (mapped to
 * the dedicated "Request timed out" preset) rather than the generic `Error`
 * the shared utility would otherwise produce.
 *
 * Previously this constructed `LedgerConnectionError` for every timeout —
 * indistinguishable from a genuine connection failure, so a stuck on-device
 * confirmation (nothing wrong with the connection, the user just hasn't
 * confirmed/rejected yet) and an actual failed connect both surfaced the same
 * generic "Connection failed" screen with no way to tell which had happened.
 *
 * `operation` is a developer-facing label for the error message (logs /
 * debugging only) — deliberately not localized. User-facing copy is resolved
 * from the error's classified kind by the UI's `getLedgerErrorPreset`.
 */
export const ledgerTimeoutReason =
    (operation: string) =>
    (_op: string, ms: number): Error =>
        new LedgerTimeoutError(`${operation} (${ms}ms ceiling)`)

/**
 * Bounds a transport connect/derive call by the connection ceiling. Per the
 * `withTimeout` contract the caller still owns any late-resolving transport
 * and must disconnect it.
 */
export const withLedgerConnectionTimeout = <T>(
    promise: Promise<T>,
    operation: string,
): Promise<T> =>
    withTimeout(
        promise,
        LEDGER_CONNECTION_TIMEOUT_MS,
        operation,
        ledgerTimeoutReason(operation),
    )

/**
 * Bounds a call that waits for an on-device confirmation (address verify,
 * `getAddress` with display). The ceiling is deliberately generous — it must
 * never be shorter than a legitimate on-device review.
 */
export const withLedgerConfirmationTimeout = <T>(
    promise: Promise<T>,
    operation: string,
): Promise<T> =>
    withTimeout(
        promise,
        LEDGER_CONFIRMATION_TIMEOUT_MS,
        operation,
        ledgerTimeoutReason(operation),
    )
