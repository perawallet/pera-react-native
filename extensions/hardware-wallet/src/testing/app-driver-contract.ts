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


import { describe, expect, it, vi } from 'vitest'
import { AppError, ErrorCategory } from '@perawallet/wallet-core-shared'
import type { LedgerAppDriver, LedgerAppTransport } from '../app-driver'

export interface LedgerAppDriverContractFixtures {
    /** Makes the next exchange with the device app fail with `error`. */
    arrangeExchangeFailure(error: unknown): void
}

const rawTransport = (
    emitter?: Pick<LedgerAppTransport, 'on' | 'off'>,
): LedgerAppTransport => ({ close: vi.fn(async () => undefined), ...emitter })

/** Every chain package runs this against its own Ledger app driver. */
export const ledgerAppDriverContractTests = (
    makeDriver: () => LedgerAppDriver,
    fixtures: LedgerAppDriverContractFixtures,
): void => {
    describe(`LedgerAppDriver contract: ${makeDriver().chainId}`, () => {
        it('serves a chain', () => {
            expect(makeDriver().chainId).toMatch(/\S/)
        })

        it('closes the device link on disconnect', async () => {
            const raw = rawTransport()

            await makeDriver().open(raw).disconnect()

            expect(raw.close).toHaveBeenCalledOnce()
        })

        it('omits disconnect detection when the link emits nothing', () => {
            expect(makeDriver().open(rawTransport()).onDisconnect).toBeUndefined()
        })

        it('relays disconnects when the link emits them', () => {
            const on = vi.fn()
            const off = vi.fn()
            const listener = vi.fn()

            const unsubscribe = makeDriver()
                .open(rawTransport({ on, off }))
                .onDisconnect?.(listener)

            expect(on).toHaveBeenCalledWith('disconnect', expect.any(Function))
            on.mock.calls[0][1]()
            expect(listener).toHaveBeenCalledOnce()
            unsubscribe?.()
            expect(off).toHaveBeenCalledWith('disconnect', on.mock.calls[0][1])
        })

        it("throws the transport's classification of a failed exchange", async () => {
            const failure = new Error('apdu failed')
            const classified = new AppError('classified', {
                category: ErrorCategory.UNKNOWN,
            })
            const classifyError = vi.fn(() => classified)
            fixtures.arrangeExchangeFailure(failure)

            await expect(
                makeDriver().open(rawTransport(), classifyError).getAppVersion(),
            ).rejects.toBe(classified)
            expect(classifyError).toHaveBeenCalledWith(failure)
        })
    })
}
