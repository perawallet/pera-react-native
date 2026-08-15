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
    // write failure must not escape it. The runner marks this revision applied
    // the moment `up` resolves, so there's no later run to retry from — the
    // affected ids are gone for good, and `console.warn` is the only trace
    // left (per the module doc, `report.failed`/`utils.log` never see it).
    it('does not throw, and logs, when the ledger write fails', () => {
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
            createDeclinedRegister(throwingStore).record(MODULE, ['a']),
        ).not.toThrow()
        expect(consoleWarn).toHaveBeenCalledOnce()
        expect(consoleWarn.mock.calls[0][0]).toContain(MODULE)
    })

    // An unreadable ledger inside `record` must not be treated as "nothing
    // recorded yet" the way a corrupt-JSON note is: a corrupt note's content
    // is already unrecoverable garbage, but an unreadable one gives no
    // evidence its content is bad — it might still be perfectly good.
    // Unioning against `[]` here would overwrite it with only the new ids,
    // destroying data that might have been recoverable. Skipping the write
    // entirely, and logging, is the safer failure mode — and, same as the
    // write-failure case above, permanent: there is no later run of this
    // revision to retry from.
    it('does not throw, does not write, and logs, when the ledger read fails inside record', () => {
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
            createDeclinedRegister(throwingStore).record(MODULE, ['a']),
        ).not.toThrow()
        expect(setCalls).toBe(0)
        expect(consoleWarn).toHaveBeenCalledOnce()
        expect(consoleWarn.mock.calls[0][0]).toContain(MODULE)
    })

    it('does not throw when store.getString fails inside read', () => {
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
    })
})
