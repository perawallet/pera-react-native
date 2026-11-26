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

import { describe, expect, test } from 'vitest'
import { buildBackupCredentialsFile } from '../backupCredentialsFile'
import {
    matchesBackupEncryptionKey,
    normalizeBackupEncryptionKey,
} from '../backupEncryptionKeyInput'
import { generateCloudBackupCredentials } from '../generateCloudBackupCredentials'

const { salt } = generateCloudBackupCredentials()
const file = buildBackupCredentialsFile(salt)
const exported = (JSON.parse(file) as { salt: string }).salt

const flipFirstLetterCase = (value: string): string => {
    const index = value.search(/[A-Za-z]/)
    const letter = value[index]
    const flipped =
        letter === letter.toUpperCase()
            ? letter.toLowerCase()
            : letter.toUpperCase()
    return `${value.slice(0, index)}${flipped}${value.slice(index + 1)}`
}

const acceptedForms: Record<string, string> = {
    'as exported': exported,
    'with surrounding line breaks': `\n${exported}\n`,
    'wrapped across lines with a stray space': `${exported.slice(0, 7)}\n${exported.slice(7, 15)} ${exported.slice(15)}`,
    'with invisible and non-breaking characters': `${exported.slice(0, 4)}\u200B${exported.slice(4, 9)}\u200E${exported.slice(9, 14)}\u00A0${exported.slice(14)}`,
    'in straight quotes': `"${exported}"`,
    'in curly quotes': `\u201C${exported}\u201D`,
    'as the whole credentials file': file,
    'as the whole credentials file, pretty-printed': JSON.stringify(
        JSON.parse(file),
        null,
        2,
    ),
}

describe('normalizeBackupEncryptionKey', () => {
    test.each(Object.entries(acceptedForms))(
        'reduces the key %s to its salt',
        (_, input) => {
            expect(normalizeBackupEncryptionKey(input)).toBe(exported)
        },
    )

    test('keeps case, alphabet and padding as typed', () => {
        expect(normalizeBackupEncryptionKey('ab-_Cd==')).toBe('ab-_Cd==')
    })
})

describe('matchesBackupEncryptionKey', () => {
    test.each(Object.entries(acceptedForms))(
        'matches the stored salt when the key is %s',
        (_, input) => {
            expect(matchesBackupEncryptionKey(input, salt)).toBe(true)
        },
    )

    test('rejects the key of another backup', () => {
        const other = generateCloudBackupCredentials().salt

        expect(matchesBackupEncryptionKey(other, salt)).toBe(false)
    })

    test('rejects a key with one letter in the wrong case', () => {
        expect(
            matchesBackupEncryptionKey(flipFirstLetterCase(exported), salt),
        ).toBe(false)
    })

    test('rejects a key missing its padding', () => {
        expect(
            matchesBackupEncryptionKey(exported.replace(/=+$/, ''), salt),
        ).toBe(false)
    })

    test('rejects empty input', () => {
        expect(matchesBackupEncryptionKey('', salt)).toBe(false)
    })

    test('never matches when no salt is stored', () => {
        expect(matchesBackupEncryptionKey(exported, null)).toBe(false)
        expect(matchesBackupEncryptionKey('', null)).toBe(false)
    })

    test('rejects text that is not base64', () => {
        expect(matchesBackupEncryptionKey('not base64!', salt)).toBe(false)
    })
})
