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
import { useMultisigNotificationIntentStore } from '../useMultisigNotificationIntentStore'

describe('useMultisigNotificationIntentStore', () => {
    beforeEach(() => {
        useMultisigNotificationIntentStore.getState().resetState()
    })

    it('starts with no pending intent', () => {
        expect(
            useMultisigNotificationIntentStore.getState().pendingIntent,
        ).toBeNull()
    })

    it('stores a sign intent set by the caller', () => {
        useMultisigNotificationIntentStore.getState().setIntent({
            kind: 'sign',
            address: 'MSIG_ADDR',
        })
        expect(
            useMultisigNotificationIntentStore.getState().pendingIntent,
        ).toEqual({ kind: 'sign', address: 'MSIG_ADDR' })
    })

    it('stores an import intent set by the caller', () => {
        useMultisigNotificationIntentStore.getState().setIntent({
            kind: 'import',
            address: 'MSIG_ADDR_IMPORT',
        })
        expect(
            useMultisigNotificationIntentStore.getState().pendingIntent,
        ).toEqual({ kind: 'import', address: 'MSIG_ADDR_IMPORT' })
    })

    it('clears the pending intent on consumeIntent', () => {
        useMultisigNotificationIntentStore
            .getState()
            .setIntent({ kind: 'sign', address: 'MSIG_ADDR' })
        useMultisigNotificationIntentStore.getState().consumeIntent()
        expect(
            useMultisigNotificationIntentStore.getState().pendingIntent,
        ).toBeNull()
    })

    it('clears the pending intent on resetState', () => {
        useMultisigNotificationIntentStore
            .getState()
            .setIntent({ kind: 'import', address: 'MSIG_ADDR' })
        useMultisigNotificationIntentStore.getState().resetState()
        expect(
            useMultisigNotificationIntentStore.getState().pendingIntent,
        ).toBeNull()
    })
})
