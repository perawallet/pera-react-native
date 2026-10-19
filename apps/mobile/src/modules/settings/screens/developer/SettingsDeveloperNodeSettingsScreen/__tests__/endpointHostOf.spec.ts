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

import { describe, expect, it } from 'vitest'
import { endpointHostOf } from '../endpointHostOf'

describe('endpointHostOf', () => {
    it('keeps the port with the host', () => {
        expect(endpointHostOf('http://192.168.1.50:8545')).toBe(
            '192.168.1.50:8545',
        )
    })

    it('leaves out a path and query that may carry an API key', () => {
        expect(
            endpointHostOf('https://sepolia.provider.example/v3/secret-key?x=1'),
        ).toBe('sepolia.provider.example')
    })

    it.each([undefined, '', 'not a url'])(
        'reports no host for %j',
        value => {
            expect(endpointHostOf(value)).toBeUndefined()
        },
    )
})
