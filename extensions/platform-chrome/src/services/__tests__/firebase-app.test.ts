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

import { afterEach, describe, expect, it, vi } from 'vitest'

const initializeAppMock = vi.hoisted(() =>
    vi.fn(() => ({ name: '[DEFAULT]' })),
)
vi.mock('firebase/app', () => ({ initializeApp: initializeAppMock }))

const configMock = vi.hoisted(() => ({
    config: {
        firebaseApiKey: '',
        firebaseAuthDomain: '',
        firebaseDatabaseUrl: '',
        firebaseProjectId: '',
        firebaseStorageBucket: '',
        firebaseMessagingSenderId: '',
        firebaseAppId: '',
        firebaseMeasurementId: '',
    },
}))
vi.mock('@perawallet/wallet-core-config', () => configMock)

describe('getFirebaseApp', () => {
    afterEach(() => {
        vi.resetModules()
        initializeAppMock.mockClear()
        configMock.config.firebaseProjectId = ''
    })

    it('returns null when firebaseProjectId is unset', async () => {
        const { getFirebaseApp } = await import('../firebase-app')
        expect(getFirebaseApp()).toBeNull()
        expect(initializeAppMock).not.toHaveBeenCalled()
    })

    it('initializes once and caches the app when firebaseProjectId is set', async () => {
        configMock.config.firebaseProjectId = 'test-project'
        const { getFirebaseApp } = await import('../firebase-app')
        const first = getFirebaseApp()
        const second = getFirebaseApp()
        expect(initializeAppMock).toHaveBeenCalledTimes(1)
        expect(first).toBe(second)
    })
})
