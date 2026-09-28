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

import { describe, expect, it, beforeEach } from 'vitest'
import { useAppIntegrityStore } from '../../store'
import { getValidIntegrityToken } from '../getValidIntegrityToken'

const registration = (expiresAt: string) => ({
    integrityToken: 'attestation-jwt',
    expiresAt,
    keyId: 'k1',
    deviceInstallationId: 'd1',
})

describe('getValidIntegrityToken', () => {
    beforeEach(() => {
        useAppIntegrityStore.getState().resetState()
    })

    it('returns the token while it is unexpired', () => {
        const future = new Date(Date.now() + 60_000).toISOString()
        useAppIntegrityStore.getState().setRegistration(registration(future))

        expect(getValidIntegrityToken()).toBe('attestation-jwt')
    })

    it('returns null when the token is expired', () => {
        const past = new Date(Date.now() - 60_000).toISOString()
        useAppIntegrityStore.getState().setRegistration(registration(past))

        expect(getValidIntegrityToken()).toBeNull()
    })

    it('returns null when no registration is stored', () => {
        expect(getValidIntegrityToken()).toBeNull()
    })

    it('returns null for an unparseable expiry', () => {
        useAppIntegrityStore
            .getState()
            .setRegistration(registration('not-a-date'))

        expect(getValidIntegrityToken()).toBeNull()
    })
})
