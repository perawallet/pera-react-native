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

import { describe, it, expect, beforeEach } from 'vitest'
import { useMnemonicHandoffStore } from '../useMnemonicHandoffStore'

describe('useMnemonicHandoffStore', () => {
    beforeEach(() => {
        useMnemonicHandoffStore.getState().resetState()
    })

    it('stash returns a string id and stores the entry', () => {
        const entry = { accountType: 'hdWallet' as const, mnemonic: 'a b c' }
        const id = useMnemonicHandoffStore.getState().stash(entry)

        expect(typeof id).toBe('string')
        expect(id.length).toBeGreaterThan(0)
        expect(useMnemonicHandoffStore.getState().pending.get(id)).toEqual(
            entry,
        )
    })

    it('consume returns the entry once and clears it', () => {
        const entry = { accountType: 'hdWallet' as const, mnemonic: 'a b c' }
        const id = useMnemonicHandoffStore.getState().stash(entry)

        const first = useMnemonicHandoffStore.getState().consume(id)
        const second = useMnemonicHandoffStore.getState().consume(id)

        expect(first).toEqual(entry)
        expect(second).toBeNull()
    })

    it('consume returns null for an unknown id', () => {
        expect(
            useMnemonicHandoffStore.getState().consume('nonexistent'),
        ).toBeNull()
    })

    it('produces unique ids for consecutive stashes', () => {
        const a = useMnemonicHandoffStore
            .getState()
            .stash({ accountType: 'hdWallet', mnemonic: 'one' })
        const b = useMnemonicHandoffStore
            .getState()
            .stash({ accountType: 'algo25', mnemonic: 'two' })

        expect(a).not.toBe(b)
    })

    it('resetState empties pending entries', () => {
        useMnemonicHandoffStore
            .getState()
            .stash({ accountType: 'hdWallet', mnemonic: 'x' })

        useMnemonicHandoffStore.getState().resetState()

        expect(useMnemonicHandoffStore.getState().pending.size).toBe(0)
    })
})
