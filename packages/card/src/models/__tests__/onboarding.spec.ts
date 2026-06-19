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
import {
    PASSWORD_RULES,
    addressSchema,
    dobToIsoDate,
    formatDobInput,
    isoDateToDob,
    passwordSetSchema,
    personalDetailsSchema,
} from '../onboarding'

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

describe('PASSWORD_RULES', () => {
    it('every rule passes for a fully valid password', () => {
        expect(PASSWORD_RULES.every(rule => rule.test('Passw0rd!'))).toBe(true)
    })

    it.each([
        ['length', 'Pa0!'],
        ['uppercase', 'passw0rd!'],
        ['lowercase', 'PASSW0RD!'],
        ['number', 'Password!'],
        ['special', 'Passw0rd'],
    ])('the %s rule fails its targeted password', (id, password) => {
        const rule = PASSWORD_RULES.find(candidate => candidate.id === id)

        expect(rule).toBeDefined()
        expect(rule?.test(password)).toBe(false)
    })

    it('stays in lockstep with passwordSetSchema', () => {
        // A password that satisfies every rule must parse, and one that fails a
        // rule must not — guarding the derived-schema parity.
        expect(parse('Passw0rd!').success).toBe(true)
        expect(parse('passw0rd!').success).toBe(false)
    })
})

describe('personalDetailsSchema', () => {
    const valid = {
        firstName: 'John',
        lastName: 'Morgan',
        dateOfBirth: '27/02/1986',
        countryOfNationality: 'GB',
    }

    it('accepts a complete, valid record', () => {
        expect(personalDetailsSchema.safeParse(valid).success).toBe(true)
    })

    it('accepts a real leap-day date', () => {
        expect(
            personalDetailsSchema.safeParse({
                ...valid,
                dateOfBirth: '29/02/2000',
            }).success,
        ).toBe(true)
    })

    it('accepts the 1900 lower-bound year', () => {
        expect(
            personalDetailsSchema.safeParse({
                ...valid,
                dateOfBirth: '01/01/1900',
            }).success,
        ).toBe(true)
    })

    it.each([
        ['empty first name', { firstName: '   ' }],
        ['empty last name', { lastName: '' }],
        ['malformed date', { dateOfBirth: '1986-02-27' }],
        ['impossible date', { dateOfBirth: '31/02/1990' }],
        ['leap day in a non-leap year', { dateOfBirth: '29/02/2001' }],
        ['future date', { dateOfBirth: '01/01/2999' }],
        ['pre-1900 year (typo guard)', { dateOfBirth: '01/01/0186' }],
        ['short nationality', { countryOfNationality: 'G' }],
    ])('rejects a record with %s', (_label, override) => {
        expect(
            personalDetailsSchema.safeParse({ ...valid, ...override }).success,
        ).toBe(false)
    })
})

describe('formatDobInput', () => {
    it.each([
        ['1', '1'],
        ['01', '01'],
        ['27', '27'],
        ['0102', '01/02'],
        ['2702', '27/02'],
        ['01021986', '01/02/1986'],
        ['27021986', '27/02/1986'],
        ['27/02/1986', '27/02/1986'],
        ['27a02b1986extra', '27/02/1986'],
    ])('masks %s into %s', (raw, expected) => {
        expect(formatDobInput(raw)).toBe(expected)
    })
})

describe('dobToIsoDate', () => {
    it('converts DD/MM/YYYY to ISO YYYY-MM-DD', () => {
        expect(dobToIsoDate('27/02/1986')).toBe('1986-02-27')
    })
})

describe('isoDateToDob', () => {
    it('converts a full ISO datetime to DD/MM/YYYY using the date part only', () => {
        // String-only, so the day never shifts by timezone (the trailing
        // T00:00:00.000Z would slip to the previous day via `new Date().getDate()`
        // in negative-UTC zones).
        expect(isoDateToDob('1997-11-08T00:00:00.000Z')).toBe('08/11/1997')
    })

    it('converts a date-only ISO string', () => {
        expect(isoDateToDob('1986-02-27')).toBe('27/02/1986')
    })

    it('round-trips with dobToIsoDate', () => {
        expect(dobToIsoDate(isoDateToDob('1997-11-08T00:00:00.000Z'))).toBe(
            '1997-11-08',
        )
    })
})

describe('addressSchema', () => {
    const valid = {
        countryIso: 'GB',
        addressLine1: '3 Ryecroft Glen Road',
        city: 'Sheffield',
        zip: 'S17 3RA',
    }

    it('accepts a complete non-US address (no state needed)', () => {
        expect(addressSchema.safeParse(valid).success).toBe(true)
    })

    it('accepts an optional second address line', () => {
        expect(
            addressSchema.safeParse({ ...valid, addressLine2: 'Flat 2' })
                .success,
        ).toBe(true)
    })

    it.each([
        ['missing street', { addressLine1: '   ' }],
        ['missing city', { city: '' }],
        ['missing zip', { zip: '' }],
        ['bad country length', { countryIso: 'GBR' }],
    ])('rejects a record with %s', (_label, override) => {
        expect(addressSchema.safeParse({ ...valid, ...override }).success).toBe(
            false,
        )
    })

    it('requires a state for US residents', () => {
        const result = addressSchema.safeParse({
            ...valid,
            countryIso: 'US',
            zip: '90001',
        })

        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.issues[0]?.path).toEqual(['usState'])
        }
    })

    it('accepts a US address once a state is provided', () => {
        expect(
            addressSchema.safeParse({
                ...valid,
                countryIso: 'US',
                zip: '90001',
                usState: 'CA',
            }).success,
        ).toBe(true)
    })
})
