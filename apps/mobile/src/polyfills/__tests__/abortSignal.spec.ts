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

import { describe, it, expect, afterEach } from 'vitest'
import { installAbortSignalThrowIfAborted } from '../abortSignal'

// Mirrors React Native's abort-controller@3 signal: `aborted` only, no
// `reason`, no `throwIfAborted`.
class LegacySignal {
    aborted = false
    reason: unknown = undefined
}

type Patched = LegacySignal & { throwIfAborted: () => void }

const install = () =>
    installAbortSignalThrowIfAborted(
        LegacySignal as unknown as typeof AbortSignal,
    )

describe('installAbortSignalThrowIfAborted', () => {
    afterEach(() => {
        delete (LegacySignal.prototype as Partial<Patched>).throwIfAborted
    })

    it('adds throwIfAborted to a signal class that lacks it', () => {
        install()

        const signal = new LegacySignal() as Patched
        expect(typeof signal.throwIfAborted).toBe('function')
        expect(() => signal.throwIfAborted()).not.toThrow()
    })

    it('throws the abort reason once the signal is aborted', () => {
        install()
        const signal = new LegacySignal() as Patched
        const reason = new Error('cancelled by caller')
        signal.aborted = true
        signal.reason = reason

        expect(() => signal.throwIfAborted()).toThrow(reason)
    })

    it('throws an AbortError when the aborted signal carries no reason', () => {
        install()
        const signal = new LegacySignal() as Patched
        signal.aborted = true

        expect(() => signal.throwIfAborted()).toThrow(
            expect.objectContaining({ name: 'AbortError' }),
        )
    })

    it('leaves an existing implementation untouched', () => {
        const native = () => undefined
        ;(LegacySignal.prototype as Patched).throwIfAborted = native

        install()

        expect((LegacySignal.prototype as Patched).throwIfAborted).toBe(native)
    })

    it('is a no-op on a runtime that already has it', () => {
        const before = AbortSignal.prototype.throwIfAborted

        installAbortSignalThrowIfAborted(AbortSignal)

        expect(AbortSignal.prototype.throwIfAborted).toBe(before)
    })
})
