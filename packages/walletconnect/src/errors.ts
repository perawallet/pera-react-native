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

import {
    AppError,
    ErrorCategory,
    type ErrorMetadata,
    ErrorSeverity,
    type Nullable,
} from '@perawallet/wallet-core-shared'

/**
 * Base walletconnect error
 */
export class WalletConnectError extends AppError {
    constructor(
        message: string,
        originalError?: Error,
        metadata?: Partial<ErrorMetadata>,
    ) {
        super(
            message,
            {
                severity: ErrorSeverity.HIGH,
                category: ErrorCategory.WALLETCONNECT,
                retryable: false,
                messageKey: 'errors.walletconnect.body',
                ...metadata,
            },
            originalError,
        )
    }
}

export class WalletConnectInvalidSessionError extends WalletConnectError {
    constructor(message?: string, originalError?: Error) {
        super(message ?? 'The session was missing or invalid.', originalError, {
            messageKey: 'errors.walletconnect.invalid_session_body',
        })
    }
}

export class WalletConnectSignRequestError extends WalletConnectError {
    constructor(message?: string, originalError?: Error) {
        super(
            message ?? 'An error has occurred during the signing process.',
            originalError,
            { messageKey: 'errors.walletconnect.sign_request_body' },
        )
    }
}

export class WalletConnectPermissionError extends WalletConnectError {
    constructor(message?: string, originalError?: Error) {
        super(message ?? 'Permission denied', originalError, {
            messageKey: 'errors.walletconnect.permission_body',
        })
    }
}

export class WalletConnectInvalidNetworkError extends WalletConnectError {
    constructor(message?: string, originalError?: Error) {
        super(
            message ??
                "The network doesn't match with the network your app is currently connected to.",
            originalError,
            { messageKey: 'errors.walletconnect.invalid_network_body' },
        )
    }
}

/**
 * The WalletConnect bridge socket could not be (re)opened in time to
 * deliver a signed payload to the dApp.
 *
 * WalletConnect v1's socket transport silently queues outgoing messages
 * when its WebSocket is down (no throw, no callback), so a signed
 * transaction handed back over a dead socket is lost while the UI still
 * reports success. The connector registry recreates a fresh socket and
 * throws this error if it cannot open in time — making the signing
 * pipeline surface an honest failure instead. Marked `retryable` so the
 * signing machine offers a Retry: a later attempt often lands once the
 * socket reconnects.
 */
export class WalletConnectConnectionTimeoutError extends WalletConnectError {
    constructor(message?: string, originalError?: Error) {
        super(
            message ??
                "Couldn't reach WalletConnect to deliver your signed transaction. Check your connection and try again.",
            originalError,
            {
                retryable: true,
                messageKey: 'errors.walletconnect.connection_timeout_body',
            },
        )
    }
}

/**
 * A queued session request outlived `SESSION_REQUEST_TTL_MS` before the
 * user acted on it — the dApp's side of the handshake has expired, so
 * approving it can only produce a fake "Connected!".
 */
export class WalletConnectSessionRequestExpiredError extends WalletConnectError {
    constructor(message?: string, originalError?: Error) {
        super(
            message ??
                'This connection request has expired. Start a new connection from the dApp and try again.',
            originalError,
            {
                messageKey:
                    'errors.walletconnect.session_request_expired_body',
            },
        )
    }
}

/**
 * Read the originating connector's `clientId` off a surfaced WalletConnect
 * error, if one was stamped on it (see `surfaceError`). `connectionError` is a
 * single shared store field written from several connectors, so consumers that
 * only care about a specific pairing/session (the QR pairing waiter, the
 * provider's pending-request cleanup) use this to ignore errors that belong to
 * a different connector. Reads structurally so it works for both
 * {@link WalletConnectError} and raw `Error`s that were tagged.
 */
export const getConnectionErrorClientId = (
    error: Nullable<Error>,
): string | undefined => {
    const clientId = (error as { clientId?: unknown } | null)?.clientId
    return typeof clientId === 'string' ? clientId : undefined
}
