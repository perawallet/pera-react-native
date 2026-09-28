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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
    LEDGER_CONFIRMATION_TIMEOUT_MS,
    LEDGER_CONNECTION_TIMEOUT_MS,
    LedgerDeviceNotFoundError,
    LedgerTimeoutError,
} from '@perawallet/wallet-extension-ledger-shared'
import {
    withLedgerConfirmationTimeout,
    withLedgerConnectionTimeout,
} from '../ledgerTimeouts'

const never = () => new Promise<never>(() => undefined)

describe('ledgerTimeouts', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('reports a connect that never completes as device-not-found', async () => {
        const result = withLedgerConnectionTimeout(never(), 'connect')
        const assertion = expect(result).rejects.toBeInstanceOf(
            LedgerDeviceNotFoundError,
        )

        await vi.advanceTimersByTimeAsync(LEDGER_CONNECTION_TIMEOUT_MS)

        await assertion
    })

    it('reports a confirmation that never arrives as a timeout', async () => {
        const result = withLedgerConfirmationTimeout(never(), 'verify')
        const assertion =
            expect(result).rejects.toBeInstanceOf(LedgerTimeoutError)

        await vi.advanceTimersByTimeAsync(LEDGER_CONFIRMATION_TIMEOUT_MS)

        await assertion
    })

    it('passes a result through when it lands inside the ceiling', async () => {
        await expect(
            withLedgerConfirmationTimeout(Promise.resolve('ok'), 'verify'),
        ).resolves.toBe('ok')
    })
})
