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

import { describe, expect, it, beforeEach } from 'vitest'
import { useAppIntegrityStore } from '../store'

describe('useAppIntegrityStore', () => {
    beforeEach(() => useAppIntegrityStore.getState().resetState())

    it('stores a registration result', () => {
        useAppIntegrityStore.getState().setRegistration({
            integrityToken: 'jwt',
            expiresAt: '2026-07-01',
            keyId: 'k1',
            deviceId: 'd1',
        })
        const state = useAppIntegrityStore.getState()
        expect(state.integrityToken).toBe('jwt')
        expect(state.keyId).toBe('k1')
        expect(state.status).toBe('success')
        expect(state.lastSuccessAt).not.toBeNull()
    })

    it('records errors', () => {
        useAppIntegrityStore.getState().setError('boom')
        const state = useAppIntegrityStore.getState()
        expect(state.status).toBe('error')
        expect(state.lastError).toBe('boom')
    })

    it('resets to defaults', () => {
        useAppIntegrityStore.getState().setError('boom')
        useAppIntegrityStore.getState().resetState()
        expect(useAppIntegrityStore.getState().status).toBe('idle')
        expect(useAppIntegrityStore.getState().lastError).toBeNull()
    })
})
