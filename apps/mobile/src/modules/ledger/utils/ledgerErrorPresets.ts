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

import {
    LedgerAppNotOpenError,
    LedgerAddressMismatchError,
    LedgerBluetoothDisabledError,
    LedgerConnectionError,
    LedgerDisconnectedError,
    LedgerNetworkError,
    LedgerPermissionDeniedError,
    LedgerPublicKeyReadError,
    LedgerScanTimeoutError,
    LedgerSigningFailedError,
    LedgerTimeoutError,
    LedgerTransmissionError,
    LedgerUnsupportedDeviceError,
    LedgerUserRejectedError,
} from '@perawallet/wallet-core-ledger'
import type { LedgerErrorPresetKind } from '@perawallet/wallet-core-signing'

export type { LedgerErrorPresetKind }

export type LedgerErrorPreset = {
    kind: LedgerErrorPresetKind
    title: string
    body: string
    isTroubleshootable: boolean
    isRetryable: boolean
}

type Translate = (key: string, options?: Record<string, unknown>) => string

const TROUBLESHOOTABLE_KINDS: ReadonlySet<LedgerErrorPresetKind> = new Set([
    'bluetooth_disabled',
    'bluetooth_permission',
    'scan_timeout',
    'connection_failed',
    'connection_lost',
])

const NON_RETRYABLE_KINDS: ReadonlySet<LedgerErrorPresetKind> = new Set([
    'address_mismatch',
    'unsupported_device',
])

const KIND_BY_ERROR: Array<{
    match: (error: Error) => boolean
    kind: LedgerErrorPresetKind
}> = [
    // Order: subclasses / specific cases first, generic cases last.
    {
        match: error => error instanceof LedgerBluetoothDisabledError,
        kind: 'bluetooth_disabled',
    },
    {
        match: error => error instanceof LedgerPermissionDeniedError,
        kind: 'bluetooth_permission',
    },
    {
        match: error => error instanceof LedgerScanTimeoutError,
        kind: 'scan_timeout',
    },
    {
        match: error => error instanceof LedgerUserRejectedError,
        kind: 'user_rejected',
    },
    {
        match: error => error instanceof LedgerAppNotOpenError,
        kind: 'app_not_open',
    },
    {
        match: error => error instanceof LedgerAddressMismatchError,
        kind: 'address_mismatch',
    },
    {
        match: error => error instanceof LedgerSigningFailedError,
        kind: 'signing_failed',
    },
    {
        match: error => error instanceof LedgerTransmissionError,
        kind: 'transmission_error',
    },
    {
        match: error => error instanceof LedgerPublicKeyReadError,
        kind: 'public_key_read_failed',
    },
    {
        match: error => error instanceof LedgerNetworkError,
        kind: 'network_error',
    },
    {
        match: error => error instanceof LedgerUnsupportedDeviceError,
        kind: 'unsupported_device',
    },
    {
        match: error => error instanceof LedgerDisconnectedError,
        kind: 'connection_lost',
    },
    // Generic timeout collapses into scan_timeout for the UX.
    {
        match: error => error instanceof LedgerTimeoutError,
        kind: 'scan_timeout',
    },
    {
        match: error => error instanceof LedgerConnectionError,
        kind: 'connection_failed',
    },
]

/**
 * Maps a Ledger-domain error (or plain Error) to a user-facing preset for the
 * shared PWResultView. Falls back to generic "connection_failed" copy for
 * anything we don't recognise so the UI is always actionable.
 */
export const getLedgerErrorPreset = (
    error: unknown,
    t: Translate,
): LedgerErrorPreset => {
    const kind: LedgerErrorPresetKind =
        error instanceof Error
            ? (KIND_BY_ERROR.find(entry => entry.match(error))?.kind ??
              'connection_failed')
            : 'connection_failed'

    return {
        kind,
        title: t(`ledger.errors.${kind}_title`),
        body: t(`ledger.errors.${kind}`),
        isTroubleshootable: TROUBLESHOOTABLE_KINDS.has(kind),
        isRetryable: !NON_RETRYABLE_KINDS.has(kind),
    }
}

/**
 * Builds a preset directly from a `LedgerErrorPresetKind` without needing the
 * original Error instance. Used by overlay adapters whose state already holds
 * the classified kind (e.g. the hardware-signing store), so we don't have to
 * round-trip through `instanceof` matching to render the UI copy.
 */
export const getLedgerErrorPresetByKind = (
    kind: LedgerErrorPresetKind,
    t: Translate,
): LedgerErrorPreset => ({
    kind,
    title: t(`ledger.errors.${kind}_title`),
    body: t(`ledger.errors.${kind}`),
    isTroubleshootable: TROUBLESHOOTABLE_KINDS.has(kind),
    isRetryable: !NON_RETRYABLE_KINDS.has(kind),
})
