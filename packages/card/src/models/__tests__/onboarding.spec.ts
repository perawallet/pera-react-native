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
import { passwordSetSchema } from '../onboarding'

const parse = (password: string, confirmPassword = password) =>
    passwordSetSchema.safeParse({ password, confirmPassword })

describe('passwordSetSchema', () => {
    it('accepts a password meeting every rule', () => {
        expect(parse('Passw0rd!').success).toBe(true)
    })

    it.each([
        ['too short', 'Pa0!'],
        ['no uppercase', 'passw0rd!'],
        ['no lowercase', 'PASSW0RD!'],
        ['no number', 'Password!'],
        ['no special character', 'Passw0rd'],
    ])('rejects a password with %s', (_label, password) => {
        expect(parse(password).success).toBe(false)
    })

    it('rejects when the confirmation does not match', () => {
        const result = parse('Passw0rd!', 'Passw0rd?')

        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.issues[0]?.path).toEqual(['confirmPassword'])
        }
    })
})
