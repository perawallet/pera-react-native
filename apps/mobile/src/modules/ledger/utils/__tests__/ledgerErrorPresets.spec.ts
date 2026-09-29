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

import { describe, it, expect } from 'vitest'
import {
    LedgerAppNotOpenError,
    LedgerAppOutdatedError,
    LedgerConnectionError,
    LedgerDisconnectedError,
    LedgerTimeoutError,
    LedgerUserRejectedError,
    LedgerAddressMismatchError,
    LedgerBluetoothDisabledError,
    LedgerPermissionDeniedError,
    LedgerScanTimeoutError,
    LedgerSigningError,
    LedgerSigningFailedError,
    LedgerTransmissionError,
    LedgerPublicKeyReadError,
    LedgerNetworkError,
    LedgerUnsupportedDeviceError,
} from '@perawallet/wallet-core-ledger'
import {
    getLedgerErrorPreset,
    getLedgerErrorPresetByKind,
    type LedgerErrorPresetKind,
} from '../ledgerErrorPresets'

const t = (key: string) => key

describe('getLedgerErrorPreset', () => {
    it('maps LedgerUserRejectedError to user_rejected preset', () => {
        const preset = getLedgerErrorPreset(new LedgerUserRejectedError(), t)
        expect(preset.kind).toBe('user_rejected')
        expect(preset.title).toBe('ledger.errors.user_rejected_title')
        expect(preset.body).toBe('ledger.errors.user_rejected')
    })

    it('maps LedgerAppNotOpenError to app_not_open preset', () => {
        const preset = getLedgerErrorPreset(new LedgerAppNotOpenError(), t)
        expect(preset.kind).toBe('app_not_open')
    })

    it('maps LedgerDisconnectedError to connection_lost preset', () => {
        const preset = getLedgerErrorPreset(new LedgerDisconnectedError(), t)
        expect(preset.kind).toBe('connection_lost')
    })

    it('maps LedgerTimeoutError to timeout preset (distinct from scan_timeout)', () => {
        const preset = getLedgerErrorPreset(
            new LedgerTimeoutError('Sign Ledger transaction'),
            t,
        )
        expect(preset.kind).toBe('timeout')
        expect(preset.title).toBe('ledger.errors.timeout_title')
        expect(preset.body).toBe('ledger.errors.timeout')
        expect(preset.isTroubleshootable).toBe(false)
        expect(preset.isRetryable).toBe(true)
    })

    it('maps LedgerConnectionError to connection_failed preset', () => {
        const preset = getLedgerErrorPreset(
            new LedgerConnectionError('bt off'),
            t,
        )
        expect(preset.kind).toBe('connection_failed')
    })

    it('maps LedgerAddressMismatchError to address_mismatch preset', () => {
        const preset = getLedgerErrorPreset(
            new LedgerAddressMismatchError('EXPECTED_ADDR', 'ACTUAL_ADDR'),
            t,
        )
        expect(preset.kind).toBe('address_mismatch')
        expect(preset.title).toBe('ledger.errors.address_mismatch_title')
        expect(preset.body).toBe('ledger.errors.address_mismatch')
    })

    it('falls back to connection_failed for plain Error', () => {
        const preset = getLedgerErrorPreset(new Error('boom'), t)
        expect(preset.kind).toBe('connection_failed')
    })

    it('falls back to connection_failed for non-Error values', () => {
        const preset = getLedgerErrorPreset('something-broke', t)
        expect(preset.kind).toBe('connection_failed')
    })
})

describe('LedgerErrorPreset flags', () => {
    type Translate = (key: string, options?: Record<string, unknown>) => string
    const t: Translate = key => key

    it('returns isTroubleshootable=true for connection_failed', () => {
        const preset = getLedgerErrorPreset(new LedgerConnectionError('x'), t)
        expect(preset.isTroubleshootable).toBe(true)
        expect(preset.isRetryable).toBe(true)
    })

    it('returns isTroubleshootable=false for user_rejected', () => {
        const preset = getLedgerErrorPreset(new LedgerUserRejectedError(), t)
        expect(preset.isTroubleshootable).toBe(false)
        expect(preset.isRetryable).toBe(true) // can retry by re-initiating
    })

    it('returns isRetryable=false for address_mismatch', () => {
        const preset = getLedgerErrorPreset(
            new LedgerAddressMismatchError('A', 'B'),
            t,
        )
        expect(preset.isRetryable).toBe(false)
    })
})

describe('LedgerErrorPreset 14-kind taxonomy', () => {
    type Translate = (key: string, options?: Record<string, unknown>) => string
    const t: Translate = key => key

    const cases: Array<
        [Error, LedgerErrorPresetKind, { trbl: boolean; retry: boolean }]
    > = [
        [
            new LedgerBluetoothDisabledError(),
            'bluetooth_disabled',
            { trbl: true, retry: true },
        ],
        [
            new LedgerPermissionDeniedError(),
            'bluetooth_permission',
            { trbl: true, retry: true },
        ],
        [
            new LedgerScanTimeoutError('x'),
            'scan_timeout',
            { trbl: true, retry: true },
        ],
        [
            new LedgerSigningError('Empty signature returned by Ledger device'),
            'signing_failed',
            { trbl: false, retry: true },
        ],
        [
            new LedgerSigningFailedError('x'),
            'signing_failed',
            { trbl: false, retry: true },
        ],
        [
            new LedgerTransmissionError('x'),
            'transmission_error',
            { trbl: false, retry: true },
        ],
        [
            new LedgerPublicKeyReadError(),
            'public_key_read_failed',
            { trbl: false, retry: true },
        ],
        [
            new LedgerNetworkError(),
            'network_error',
            { trbl: false, retry: true },
        ],
        [
            new LedgerUnsupportedDeviceError(),
            'unsupported_device',
            { trbl: false, retry: false },
        ],
        [
            new LedgerAppOutdatedError(),
            'app_outdated',
            { trbl: false, retry: false },
        ],
    ]

    it.each(cases)(
        '%s → kind=%s, flags as expected',
        (error, expectedKind, flags) => {
            const preset = getLedgerErrorPreset(error, t)
            expect(preset.kind).toBe(expectedKind)
            expect(preset.isTroubleshootable).toBe(flags.trbl)
            expect(preset.isRetryable).toBe(flags.retry)
        },
    )

    it('LedgerScanTimeoutError beats LedgerTimeoutError because subclass matches first', () => {
        // LedgerScanTimeoutError does NOT extend LedgerTimeoutError, but
        // classifyLedgerErrorKind must check scan_timeout before timeout
        // so that future subclass relationships do not silently reclassify it.
        const preset = getLedgerErrorPreset(new LedgerScanTimeoutError('x'), t)
        expect(preset.kind).toBe('scan_timeout')
    })

    it('LedgerTimeoutError maps to timeout with isTroubleshootable=false and isRetryable=true', () => {
        const preset = getLedgerErrorPreset(
            new LedgerTimeoutError('Sign Ledger transaction'),
            t,
        )
        expect(preset.kind).toBe('timeout')
        expect(preset.isTroubleshootable).toBe(false)
        expect(preset.isRetryable).toBe(true)
    })

    it('timeout kind is NOT in the troubleshootable set', () => {
        const preset = getLedgerErrorPresetByKind('timeout', t)
        expect(preset.isTroubleshootable).toBe(false)
    })
})

describe('LedgerErrorPreset settings shortcut', () => {
    const t = (key: string) => key

    it.each([
        ['bluetooth_disabled', 'bluetooth'],
        ['bluetooth_permission', 'app_settings'],
        ['location_services_disabled', 'location'],
    ] as const)('offers the %s kind a %s shortcut', (kind, actionKind) => {
        const preset = getLedgerErrorPresetByKind(kind, t)
        expect(preset.action?.kind).toBe(actionKind)
        expect(preset.action?.label).toBeTruthy()
    })

    it.each([
        'device_not_found',
        'device_locked',
        'app_not_open',
        'device_busy',
        'user_rejected',
        'timeout',
    ] as const)(
        'offers no shortcut for %s, which is resolved on the device',
        kind => {
            expect(getLedgerErrorPresetByKind(kind, t).action).toBeNull()
        },
    )
})

describe('LedgerErrorPreset kinds added for the connection taxonomy', () => {
    const t = (key: string) => key

    it('device_not_found is retryable and links to troubleshooting', () => {
        const preset = getLedgerErrorPresetByKind('device_not_found', t)
        expect(preset.title).toBe('ledger.errors.device_not_found_title')
        expect(preset.body).toBe('ledger.errors.device_not_found')
        expect(preset.isRetryable).toBe(true)
        expect(preset.isTroubleshootable).toBe(true)
    })

    it('device_busy is retryable but not troubleshootable — its copy is the remedy', () => {
        const preset = getLedgerErrorPresetByKind('device_busy', t)
        expect(preset.isRetryable).toBe(true)
        expect(preset.isTroubleshootable).toBe(false)
    })
})

describe('getLedgerErrorPresetByKind', () => {
    type Translate = (key: string, options?: Record<string, unknown>) => string

    it('getLedgerErrorPresetByKind returns the same flags as the matcher-based classifier', () => {
        const t: Translate = key => key
        const a = getLedgerErrorPresetByKind('connection_failed', t)
        const b = getLedgerErrorPreset(new LedgerConnectionError('x'), t)
        expect(a).toEqual(b)
    })
})
