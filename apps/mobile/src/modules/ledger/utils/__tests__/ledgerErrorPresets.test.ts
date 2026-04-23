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

import { describe, it, expect } from 'vitest'
import {
    LedgerAppNotOpenError,
    LedgerConnectionError,
    LedgerDisconnectedError,
    LedgerTimeoutError,
    LedgerUserRejectedError,
    LedgerAddressMismatchError,
} from '@perawallet/wallet-core-ledger'
import { getLedgerErrorPreset } from '../ledgerErrorPresets'

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

    it('maps LedgerTimeoutError to timeout preset', () => {
        const preset = getLedgerErrorPreset(
            new LedgerTimeoutError('discovery'),
            t,
        )
        expect(preset.kind).toBe('timeout')
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
