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

import { beforeEach, describe, expect, it } from 'vitest'
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

    // `record` is called outside every `try` at all five call sites in the
    // repairs/preflight revisions — a rejecting `up` rejects `keystore.ready`
    // and, because the ledger only writes after `up` resolves, re-runs and
    // re-fails on every subsequent launch. The guard belongs here, once, not
    // at each call site.
    it('does not throw when the ledger write fails', () => {
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

    // An unreadable ledger inside `record` must not be treated as "nothing
    // recorded yet" the way a corrupt-JSON note is: that would union the new
    // ids with an empty set and overwrite whatever was actually on disk,
    // silently dropping ids a prior run recorded. Skipping the write entirely
    // is the safer failure mode.
    it('does not throw, and does not write, when the ledger read fails inside record', () => {
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
