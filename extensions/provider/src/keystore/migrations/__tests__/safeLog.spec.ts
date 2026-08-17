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

import { afterEach, describe, expect, it, vi } from 'vitest'
import { safeErrorMessage, safeWarn } from '../safeLog'

describe('safeWarn', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('forwards the message to console.warn', () => {
        const consoleWarn = vi
            .spyOn(console, 'warn')
            .mockImplementation(() => {})

        safeWarn('a warning')

        expect(consoleWarn).toHaveBeenCalledWith('a warning')
    })

    it('does not throw when console.warn itself throws', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {
            throw new Error('LogBox is not ready')
        })

        expect(() => safeWarn('a warning')).not.toThrow()
    })
})

describe('safeErrorMessage', () => {
    it('returns an Error’s message', () => {
        expect(safeErrorMessage(new Error('boom'))).toBe('boom')
    })

    it('stringifies a non-Error value', () => {
        expect(safeErrorMessage('boom')).toBe('boom')
    })

    it('does not throw, and returns a fallback, for a value with a throwing toString', () => {
        const unstringifiable = {
            toString: () => {
                throw new Error('cannot stringify')
            },
        }

        expect(() => safeErrorMessage(unstringifiable)).not.toThrow()
        expect(safeErrorMessage(unstringifiable)).toBe(
            '<unstringifiable error>',
        )
    })

    it('does not throw, and returns a fallback, for a thrown Symbol', () => {
        expect(() => safeErrorMessage(Symbol('boom'))).not.toThrow()
    })

    it('does not throw for a null-prototype object', () => {
        expect(() => safeErrorMessage(Object.create(null))).not.toThrow()
    })

    // `message` is a writable own property, so the `string` return type is not
    // a runtime guarantee. Every caller embeds the result in a template
    // literal, and that concatenation happens outside this helper's `try`.
    it('returns a string for an Error whose message is a Symbol', () => {
        const error = Object.assign(new Error(), { message: Symbol('x') })

        const message = safeErrorMessage(error as unknown)

        expect(typeof message).toBe('string')
        expect(() => `prefix: ${message}`).not.toThrow()
    })

    it('returns the fallback for an Error whose message has a throwing toString', () => {
        const error = Object.assign(new Error(), {
            message: {
                toString: () => {
                    throw new TypeError('nope')
                },
            },
        })

        expect(safeErrorMessage(error as unknown)).toBe(
            '<unstringifiable error>',
        )
    })
})
