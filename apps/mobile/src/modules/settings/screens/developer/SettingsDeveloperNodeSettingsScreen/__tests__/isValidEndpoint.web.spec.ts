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

const mocks = vi.hoisted(() => ({ appEnvironment: 'development' }))

vi.mock('@perawallet/wallet-core-config', () => ({
    config: {
        get appEnvironment() {
            return mocks.appEnvironment
        },
    },
}))

import { isValidEndpoint } from '../isValidEndpoint.web'

describe('isValidEndpoint (web)', () => {
    beforeEach(() => {
        mocks.appEnvironment = 'development'
    })

    it('accepts an https URL', () => {
        expect(isValidEndpoint('https://fnet-api.4160.nodely.dev')).toBe(true)
    })

    it('rejects a plain-http node outside loopback', () => {
        expect(isValidEndpoint('http://10.0.0.5:4001')).toBe(false)
    })

    it('accepts a plain-http LocalNet node outside production', () => {
        expect(isValidEndpoint('http://localhost:4001')).toBe(true)
        expect(isValidEndpoint('http://127.0.0.1:8980')).toBe(true)
    })

    it('rejects a plain-http LocalNet node in production', () => {
        mocks.appEnvironment = 'production'

        expect(isValidEndpoint('http://localhost:4001')).toBe(false)
    })

    it('rejects a non-URL', () => {
        expect(isValidEndpoint('not-a-url')).toBe(false)
    })
})
