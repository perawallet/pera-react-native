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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppIntegrityStore } from '../../store'
import {
    buildIntegrityHeaders,
    canCallIntegrityGuardedRoute,
} from '../integrityHeaders'

const mockConfig = vi.hoisted(() => ({
    appEnvironment: 'production' as string,
}))

vi.mock('@perawallet/wallet-core-config', () => ({ config: mockConfig }))

const BYPASS = { 'x-bypass-integrity': 'DEVELOPMENT_AND_STAGING_ONLY' }
const TOKEN = { 'x-app-integrity-token': 'jwt' }

describe('buildIntegrityHeaders', () => {
    it.each([
        ['production', 'jwt', TOKEN],
        ['production', null, {}],
        ['staging', 'jwt', { ...TOKEN, ...BYPASS }],
        ['staging', null, BYPASS],
        ['development', 'jwt', { ...TOKEN, ...BYPASS }],
        ['development', null, BYPASS],
    ])('%s with token %s sends %o', (environment, token, expected) => {
        mockConfig.appEnvironment = environment

        expect(buildIntegrityHeaders(token)).toEqual(expected)
    })

    it('treats an empty token as absent', () => {
        mockConfig.appEnvironment = 'production'

        expect(buildIntegrityHeaders('')).toEqual({})
    })

    it('never sends the bypass for an environment outside the allow-list', () => {
        mockConfig.appEnvironment = 'preview'

        expect(buildIntegrityHeaders(null)).toEqual({})
    })

    describe('reading the store by default', () => {
        beforeEach(() => {
            useAppIntegrityStore.getState().resetState()
            mockConfig.appEnvironment = 'production'
        })

        it('sends the stored token while it is unexpired', () => {
            useAppIntegrityStore.getState().setRegistration({
                integrityToken: 'jwt',
                expiresAt: new Date(Date.now() + 60_000).toISOString(),
                keyId: 'k1',
                deviceInstallationId: 'd1',
            })

            expect(buildIntegrityHeaders()).toEqual(TOKEN)
        })

        it('drops an expired stored token', () => {
            useAppIntegrityStore.getState().setRegistration({
                integrityToken: 'jwt',
                expiresAt: new Date(Date.now() - 60_000).toISOString(),
                keyId: 'k1',
                deviceInstallationId: 'd1',
            })

            expect(buildIntegrityHeaders()).toEqual({})
        })
    })
})

describe('canCallIntegrityGuardedRoute', () => {
    it.each([
        ['production', 'jwt', true],
        ['production', null, false],
        ['staging', 'jwt', true],
        ['staging', null, true],
        ['development', 'jwt', true],
        ['development', null, true],
        ['preview', null, false],
    ])('%s with token %s is %s', (environment, token, expected) => {
        mockConfig.appEnvironment = environment

        expect(canCallIntegrityGuardedRoute(token)).toBe(expected)
    })
})
