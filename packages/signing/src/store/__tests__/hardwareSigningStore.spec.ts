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
import { useHardwareSigningStore } from '../hardwareSigningStore'

describe('useHardwareSigningStore', () => {
    beforeEach(() => {
        useHardwareSigningStore.getState().resetState()
    })

    it('starts with status=searching, captures deviceName, clears error', () => {
        const store = useHardwareSigningStore.getState()
        store.setError({ kind: 'connection_failed' })
        store.start('req-1', 'Nano X')
        const state = useHardwareSigningStore.getState()
        expect(state.status).toBe('searching')
        expect(state.deviceName).toBe('Nano X')
        expect(state.error).toBeNull()
        expect(state.requestId).toBe('req-1')
    })

    it('start accepts null deviceName', () => {
        useHardwareSigningStore.getState().start('req-2', null)
        expect(useHardwareSigningStore.getState().deviceName).toBeNull()
    })

    it('setStatus transitions without clobbering progress', () => {
        const store = useHardwareSigningStore.getState()
        store.start('req-1', 'Nano X')
        store.setProgress(2, 5)
        store.setStatus('awaitingApproval')
        const state = useHardwareSigningStore.getState()
        expect(state.status).toBe('awaitingApproval')
        expect(state.currentTx).toBe(2)
        expect(state.totalTxs).toBe(5)
    })

    it('setProgress does not change status', () => {
        const store = useHardwareSigningStore.getState()
        store.start('req-1', 'Nano X')
        store.setStatus('signing')
        store.setProgress(3, 5)
        expect(useHardwareSigningStore.getState().status).toBe('signing')
    })

    it('setError flips status to error and stores payload', () => {
        const store = useHardwareSigningStore.getState()
        store.start('req-1', 'Nano X')
        store.setError({ kind: 'app_not_open' })
        const state = useHardwareSigningStore.getState()
        expect(state.status).toBe('error')
        expect(state.error?.kind).toBe('app_not_open')
    })

    it('reset returns to idle and clears all session fields', () => {
        const store = useHardwareSigningStore.getState()
        store.start('req-1', 'Nano X')
        store.setProgress(1, 3)
        store.setError({ kind: 'connection_lost' })
        store.reset()
        const state = useHardwareSigningStore.getState()
        expect(state.status).toBe('idle')
        expect(state.deviceName).toBeNull()
        expect(state.currentTx).toBeNull()
        expect(state.totalTxs).toBeNull()
        expect(state.error).toBeNull()
        expect(state.requestId).toBeNull()
    })

    it('resetState matches reset (BaseStoreState contract)', () => {
        const store = useHardwareSigningStore.getState()
        store.start('req-1', 'Nano X')
        store.resetState()
        expect(useHardwareSigningStore.getState().status).toBe('idle')
    })

    describe('isTroubleshootingVisible', () => {
        it('defaults to false', () => {
            expect(
                useHardwareSigningStore.getState().isTroubleshootingVisible,
            ).toBe(false)
        })

        it('openTroubleshooting sets isTroubleshootingVisible to true', () => {
            useHardwareSigningStore.getState().openTroubleshooting()
            expect(
                useHardwareSigningStore.getState().isTroubleshootingVisible,
            ).toBe(true)
        })

        it('closeTroubleshooting sets isTroubleshootingVisible to false', () => {
            useHardwareSigningStore.getState().openTroubleshooting()
            useHardwareSigningStore.getState().closeTroubleshooting()
            expect(
                useHardwareSigningStore.getState().isTroubleshootingVisible,
            ).toBe(false)
        })

        it('reset clears isTroubleshootingVisible', () => {
            useHardwareSigningStore.getState().openTroubleshooting()
            useHardwareSigningStore.getState().reset()
            expect(
                useHardwareSigningStore.getState().isTroubleshootingVisible,
            ).toBe(false)
        })
    })
})
