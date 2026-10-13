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

import { describe, it, expect } from 'vitest'

import { sanitizeErrorForWebview } from '../codec'

const GENERIC = 'An error occurred during signing'

const named = (name: string, message: string): Error =>
    Object.assign(new Error(message), { name })

describe('sanitizeErrorForWebview', () => {
    it('relays UserCancelledError by default, a fixed literal', () => {
        expect(
            sanitizeErrorForWebview(
                named('UserCancelledError', 'User cancelled the operation'),
            ),
        ).toBe('User cancelled the operation')
    })

    it('relays an error the caller names as relayable', () => {
        const error = named('ChainProtocolError', 'the request is malformed')

        expect(sanitizeErrorForWebview(error, ['ChainProtocolError'])).toBe(
            'the request is malformed',
        )
    })

    it('withholds a relayable name the caller did not pass', () => {
        expect(
            sanitizeErrorForWebview(
                named('ChainProtocolError', 'the request is malformed'),
            ),
        ).toBe(GENERIC)
    })

    it('withholds any other error, which may carry a path or a held address', () => {
        const address =
            'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

        expect(
            sanitizeErrorForWebview(
                named('CannotSignError', `cannot sign for ${address}`),
                ['ChainProtocolError'],
            ),
        ).toBe(GENERIC)
        expect(
            sanitizeErrorForWebview(new Error('/Users/someone/app/secret.ts')),
        ).toBe(GENERIC)
    })

    it('truncates a relayed message at 200 characters', () => {
        const error = named('ChainProtocolError', 'x'.repeat(500))

        expect(
            sanitizeErrorForWebview(error, ['ChainProtocolError']),
        ).toHaveLength(200)
    })
})
