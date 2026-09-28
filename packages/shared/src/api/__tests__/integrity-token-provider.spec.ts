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

import { afterEach, describe, expect, it } from 'vitest'
import {
    readIntegrityToken,
    setIntegrityTokenProvider,
} from '../integrity-token-provider'

describe('integrity token provider', () => {
    afterEach(() => {
        setIntegrityTokenProvider(() => null)
    })

    it('returns null before any provider is registered', () => {
        expect(readIntegrityToken()).toBeNull()
    })

    it('returns the registered provider value', () => {
        setIntegrityTokenProvider(() => 'jwt-value')

        expect(readIntegrityToken()).toBe('jwt-value')
    })

    it('swallows a throwing provider', () => {
        setIntegrityTokenProvider(() => {
            throw new Error('store not hydrated')
        })

        // This runs inside a beforeRequest hook on EVERY request. A throwing
        // provider must degrade to "no token", never break the request path.
        expect(readIntegrityToken()).toBeNull()
    })
})
