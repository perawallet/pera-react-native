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

import { beforeEach, describe, expect, it } from 'vitest'
import {
    clearPendingImportMnemonic,
    consumePendingImportMnemonic,
    setPendingImportMnemonic,
    usePendingImportMnemonicStore,
} from '../pendingImportMnemonic'

const MNEMONIC = new Array(24).fill('word').join(' ')

describe('pendingImportMnemonic store', () => {
    beforeEach(() => {
        usePendingImportMnemonicStore.getState().resetState()
    })

    it('starts empty', () => {
        expect(
            usePendingImportMnemonicStore.getState().pendingMnemonic,
        ).toBeNull()
    })

    it('set stores the mnemonic', () => {
        setPendingImportMnemonic(MNEMONIC)

        expect(usePendingImportMnemonicStore.getState().pendingMnemonic).toBe(
            MNEMONIC,
        )
    })

    it('consume returns the mnemonic and clears it in the same call', () => {
        setPendingImportMnemonic(MNEMONIC)

        const consumed = consumePendingImportMnemonic()

        expect(consumed).toBe(MNEMONIC)
        // Cleared immediately so the secret does not linger in the store.
        expect(
            usePendingImportMnemonicStore.getState().pendingMnemonic,
        ).toBeNull()
    })

    it('consume returns null and stays cleared when nothing is pending', () => {
        expect(consumePendingImportMnemonic()).toBeNull()
        expect(consumePendingImportMnemonic()).toBeNull()
    })

    it('clear removes a pending mnemonic without returning it', () => {
        setPendingImportMnemonic(MNEMONIC)

        clearPendingImportMnemonic()

        expect(
            usePendingImportMnemonicStore.getState().pendingMnemonic,
        ).toBeNull()
    })
})
