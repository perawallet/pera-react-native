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

import { ErrorSeverity } from '@perawallet/wallet-core-shared'
import { BlockchainError } from './BlockchainError'
import {
    type AlgodErrorCode,
    type AlgodErrorParamsByCode,
} from './algodErrorCodes'

/**
 * Structured algod/indexer error carrying a stable {@link AlgodErrorCode} and
 * typed params. Consume `code` + `params` in the UI to render an i18n'd
 * message; never display `.message` directly — it is an internal diagnostic
 * label, not user-facing text.
 *
 * The original underlying error (raw algosdk / node / network error) is
 * preserved via `originalError` for logging and debugging.
 */
export class AlgodError<
    C extends AlgodErrorCode = AlgodErrorCode,
> extends BlockchainError {
    public readonly code: C
    public readonly params: AlgodErrorParamsByCode[C]

    constructor(
        code: C,
        params: AlgodErrorParamsByCode[C],
        originalError?: Error,
    ) {
        super(
            `[algod:${code}] ${originalError?.message ?? code}`,
            originalError,
            {
                severity: SEVERITY[code],
                retryable: RETRYABLE[code],
                params: {
                    code,
                    ...toLoggableParams(params),
                    cause: originalError?.message,
                },
            },
        )
        this.code = code
        this.params = params
    }
}

/** Narrowing helper for consumers that want per-code handling. */
export const isAlgodError = <C extends AlgodErrorCode>(
    err: unknown,
    code?: C,
): err is AlgodError<C> => {
    if (!(err instanceof AlgodError)) return false
    return code == null || err.code === code
}

const SEVERITY: Record<AlgodErrorCode, ErrorSeverity> = {
    overspend: ErrorSeverity.MEDIUM,
    below_min_balance: ErrorSeverity.MEDIUM,
    missing_opt_in: ErrorSeverity.MEDIUM,
    duplicate_txn: ErrorSeverity.LOW,
    expired_txn: ErrorSeverity.MEDIUM,
    not_authorized: ErrorSeverity.MEDIUM,
    logic_error: ErrorSeverity.HIGH,
    network_unavailable: ErrorSeverity.MEDIUM,
    unknown_node_error: ErrorSeverity.HIGH,
}

const RETRYABLE: Record<AlgodErrorCode, boolean> = {
    overspend: false,
    below_min_balance: false,
    missing_opt_in: false,
    duplicate_txn: false,
    expired_txn: true,
    not_authorized: false,
    logic_error: false,
    network_unavailable: true,
    unknown_node_error: false,
}

// bigint values aren't JSON-serializable; convert for metadata logs while
// keeping the original typed params untouched on `this.params`.
const toLoggableParams = (
    params: Record<string, unknown>,
): Record<string, unknown> => {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(params)) {
        out[k] = typeof v === 'bigint' ? v.toString() : v
    }
    return out
}
