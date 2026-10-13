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

/** A signing request whose TTL passed before the user answered it. */
export class WalletConnectRequestExpiredError extends WalletConnectError {
    constructor(originalError?: Error) {
        super(
            'The signing request expired before it was answered',
            originalError,
            { messageKey: 'errors.walletconnect.request_expired_body' },
        )
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
 * v1 silently queues outgoing messages into a dead WebSocket, so the registry
 * throws this when a recreated socket cannot open in time. `retryable` because
 * a later attempt often lands once the socket reconnects.
 */
export class WalletConnectConnectionTimeoutError extends WalletConnectError {
    constructor(message?: string, originalError?: Error) {
        super(
            message ??
                "Couldn't reach WalletConnect to deliver your signed transaction. Check your connection and try again.",
            originalError,
            {
                retryable: true,
                expected: true,
                messageKey: 'errors.walletconnect.connection_timeout_body',
            },
        )
    }
}

/**
 * Repeated transport failures before a handshake completed; a single flap is
 * never surfaced since the transport retries itself. Scoped to the pairing so
 * the outcome waiter fails fast instead of burning its full budget in silence.
 */
export class WalletConnectBridgeConnectionError extends WalletConnectError {
    constructor(message?: string, originalError?: Error) {
        super(
            message ??
                "Couldn't connect to WalletConnect. Check your internet connection and try again.",
            originalError,
            {
                retryable: true,
                expected: true,
                messageKey: 'errors.walletconnect.bridge_connection_body',
            },
        )
    }
}

/** The dApp's side of the handshake has expired, so approving can only produce a fake "Connected!". */
export class WalletConnectSessionRequestExpiredError extends WalletConnectError {
    constructor(message?: string, originalError?: Error) {
        super(
            message ??
                'This connection request has expired. Start a new connection from the dApp and try again.',
            originalError,
            {
                messageKey: 'errors.walletconnect.session_request_expired_body',
            },
        )
    }
}

/**
 * Errors fan out from several connectors, so consumers scoped to one pairing use
 * this to ignore the rest. Reads structurally so a tagged raw `Error` works too.
 */
export const getConnectionErrorClientId = (
    error: Nullable<Error>,
): string | undefined => {
    const clientId = (error as { clientId?: unknown } | null)?.clientId
    return typeof clientId === 'string' ? clientId : undefined
}
