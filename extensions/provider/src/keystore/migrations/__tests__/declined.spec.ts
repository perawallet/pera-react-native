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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDeclinedRegister, type NoteStore } from '../declined'

const MODULE = 'com.perawallet.wallet/keystore-preflight'
const OTHER = 'com.perawallet.wallet/keystore-repairs'

let backing: Record<string, string>

const store = (): NoteStore => ({
    getString: key => backing[key],
    set: (key, value) => {
        backing[key] = value
    },
})

describe('createDeclinedRegister', () => {
    beforeEach(() => {
        backing = {}
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('reads back what it recorded', () => {
        createDeclinedRegister(store()).record(MODULE, ['a', 'b'])

        expect(createDeclinedRegister(store()).read(MODULE)).toEqual(['a', 'b'])
    })

    // The revision runs once per module but a follow-up revision may add to the
    // same note; an id recorded earlier must not be lost.
    it('unions across calls without duplicating', () => {
        const register = createDeclinedRegister(store())

        register.record(MODULE, ['a'])
        register.record(MODULE, ['b', 'a'])

        expect(register.read(MODULE)).toEqual(['a', 'b'])
    })

    it('keeps each module’s note separate', () => {
        const register = createDeclinedRegister(store())

        register.record(MODULE, ['a'])
        register.record(OTHER, ['b'])

        expect(register.read(MODULE)).toEqual(['a'])
        expect(register.read(OTHER)).toEqual(['b'])
    })

    // Writing an empty note would make "has this module ever declined
    // anything?" unanswerable without parsing.
    it('writes nothing when there is nothing to record', () => {
        createDeclinedRegister(store()).record(MODULE, [])

        expect(backing).toEqual({})
    })

    it('reads an absent note as empty', () => {
        expect(createDeclinedRegister(store()).read(MODULE)).toEqual([])
    })

    // A corrupt note must never fail the revision reading it — the worst case
    // is re-recording ids that were already there.
    it.each([
        ['unparseable', 'not json'],
        ['not an array', '{"a":1}'],
    ])('reads a %s note as empty without throwing', (_label, raw) => {
        backing[`com.perawallet.wallet/declined-records/${MODULE}`] = raw

        expect(() => createDeclinedRegister(store()).read(MODULE)).not.toThrow()
        expect(createDeclinedRegister(store()).read(MODULE)).toEqual([])
    })

    it('drops non-string entries', () => {
        backing[`com.perawallet.wallet/declined-records/${MODULE}`] =
            '["a",1,null,"b"]'

        expect(createDeclinedRegister(store()).read(MODULE)).toEqual(['a', 'b'])
    })

    // `record` is called outside every `try` at all five call sites, so a
    // write failure must not escape it. This store shares its MMKV instance
    // with the migration ledger itself, so a failing write here usually means
    // the ledger's own write fails right after — reported failed, not
    // applied, and re-run next launch. The log is the fallback for the case
    // where it isn't: `console.warn` reaches Metro in dev and the platform
    // log in release, neither of which reaches a user in the field.
    it('does not throw, and logs both the ids and the error, when the ledger write fails', () => {
        const consoleWarn = vi
            .spyOn(console, 'warn')
            .mockImplementation(() => {})
        const throwingStore: NoteStore = {
            getString: () => undefined,
            set: () => {
                throw new Error('MMKV ledger write failure')
            },
        }

        expect(() =>
            createDeclinedRegister(throwingStore).record(MODULE, [
                'cred-zzy1',
                'cred-zzy2',
            ]),
        ).not.toThrow()
        expect(consoleWarn).toHaveBeenCalledOnce()
        const message = consoleWarn.mock.calls[0][0] as string
        expect(message).toContain('ledger write failed')
        expect(message).not.toContain('could not read')
        expect(message).toContain(MODULE)
        expect(message).toContain('cred-zzy1')
        expect(message).toContain('cred-zzy2')
        expect(message).toContain('MMKV ledger write failure')
    })

    // A `console.warn` that itself throws (RN's LogBox patches it) must not
    // escape `record` either — the swallowing handler would otherwise become
    // exactly the unguarded call it exists to prevent.
    it('does not throw when console.warn itself throws during the write-failure log', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {
            throw new Error('LogBox is not ready')
        })
        const throwingStore: NoteStore = {
            getString: () => undefined,
            set: () => {
                throw new Error('MMKV ledger write failure')
            },
        }

        expect(() =>
            createDeclinedRegister(throwingStore).record(MODULE, ['a']),
        ).not.toThrow()
    })

    // A thrown value that fails `instanceof Error` and has no safe primitive
    // form (a throwing `toString`) must not make the logging path itself
    // throw via `String(error)`.
    it('does not throw when the thrown write error cannot be stringified', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        const throwingStore: NoteStore = {
            getString: () => undefined,
            set: () => {
                throw {
                    toString: () => {
                        throw new Error('cannot stringify')
                    },
                }
            },
        }

        expect(() =>
            createDeclinedRegister(throwingStore).record(MODULE, ['a']),
        ).not.toThrow()
    })

    // An unreadable ledger inside `record` must not be treated as "nothing
    // recorded yet" the way a corrupt-JSON note is: a corrupt note can't be
    // parsed at all, but an unreadable one gives no evidence its content is
    // bad — it might still be perfectly good. Unioning against `[]` here
    // would overwrite it with only the new ids, destroying data that might
    // have been recoverable. Skipping the write entirely, and logging, is
    // the safer failure mode.
    it('does not throw, does not write, and logs both the ids and the error, when the ledger read fails inside record', () => {
        const consoleWarn = vi
            .spyOn(console, 'warn')
            .mockImplementation(() => {})
        let setCalls = 0
        const throwingStore: NoteStore = {
            getString: () => {
                throw new Error('MMKV ledger read failure')
            },
            set: () => {
                setCalls += 1
            },
        }

        expect(() =>
            createDeclinedRegister(throwingStore).record(MODULE, [
                'cred-zzy1',
                'cred-zzy2',
            ]),
        ).not.toThrow()
        expect(setCalls).toBe(0)
        expect(consoleWarn).toHaveBeenCalledOnce()
        const message = consoleWarn.mock.calls[0][0] as string
        expect(message).toContain('could not read the ledger')
        expect(message).not.toContain('ledger write failed')
        expect(message).toContain(MODULE)
        expect(message).toContain('cred-zzy1')
        expect(message).toContain('cred-zzy2')
        expect(message).toContain('MMKV ledger read failure')
    })

    // The read-failure branch's own log, distinct from the write-failure one
    // above: `set` is never reached here, so only this branch's guard is
    // under test.
    it('does not throw when console.warn itself throws during the read-failure log inside record', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {
            throw new Error('LogBox is not ready')
        })
        let setCalls = 0
        const throwingStore: NoteStore = {
            getString: () => {
                throw new Error('MMKV ledger read failure')
            },
            set: () => {
                setCalls += 1
            },
        }

        expect(() =>
            createDeclinedRegister(throwingStore).record(MODULE, ['a']),
        ).not.toThrow()
        expect(setCalls).toBe(0)
    })

    it('does not throw when console.warn itself throws inside read', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {
            throw new Error('LogBox is not ready')
        })
        const throwingStore: NoteStore = {
            getString: () => {
                throw new Error('MMKV ledger read failure')
            },
            set: () => {},
        }

        expect(() =>
            createDeclinedRegister(throwingStore).read(MODULE),
        ).not.toThrow()
    })

    it('does not throw, and logs, when store.getString fails inside read', () => {
        const consoleWarn = vi
            .spyOn(console, 'warn')
            .mockImplementation(() => {})
        const throwingStore: NoteStore = {
            getString: () => {
                throw new Error('MMKV ledger read failure')
            },
            set: () => {},
        }

        expect(() =>
            createDeclinedRegister(throwingStore).read(MODULE),
        ).not.toThrow()
        expect(createDeclinedRegister(throwingStore).read(MODULE)).toEqual([])
        expect(consoleWarn).toHaveBeenCalled()
        const message = consoleWarn.mock.calls[0][0] as string
        expect(message).toContain('treating as nothing declined')
        expect(message).toContain(MODULE)
        expect(message).toContain('MMKV ledger read failure')
    })
})
