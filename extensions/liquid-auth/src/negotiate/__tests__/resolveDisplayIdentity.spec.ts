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

import { describe, it, expect } from 'vitest'
import { resolveDisplayIdentity } from '../resolveDisplayIdentity'

describe('resolveDisplayIdentity', () => {
    it('prefers the server-attested origin and marks it verified', () => {
        const identity = resolveDisplayIdentity(
            { name: 'Tinyman', origin: 'https://app.tinyman.org' },
            'https://app.tinyman.org',
        )
        expect(identity).toEqual({
            name: 'Tinyman',
            origin: 'https://app.tinyman.org',
            verified: true,
        })
    })

    it('falls back to self-asserted peer origin as unverified', () => {
        const identity = resolveDisplayIdentity(
            { name: 'Tinyman', origin: 'https://app.tinyman.org' },
            undefined,
        )
        expect(identity).toEqual({
            name: 'Tinyman',
            origin: 'https://app.tinyman.org',
            verified: false,
        })
    })

    it('falls back to the host when no peer origin is present', () => {
        const identity = resolveDisplayIdentity(
            undefined,
            undefined,
            'https://debug.liquidauth.com',
        )
        expect(identity).toEqual({
            name: 'https://debug.liquidauth.com',
            origin: 'https://debug.liquidauth.com',
            verified: false,
        })
    })
})
