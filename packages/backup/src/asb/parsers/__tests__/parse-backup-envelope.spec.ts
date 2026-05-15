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
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import { parseBackupEnvelope } from '../parse-backup-envelope'
import { AsbImportError, AsbErrorReason } from '../../errors'

const makeEnvelopeFile = (envelope: unknown): string =>
    encodeToBase64(new TextEncoder().encode(JSON.stringify(envelope)))

describe('parseBackupEnvelope', () => {
    const validEnvelope = {
        version: '1.0',
        suite: 'HMAC-SHA256:sodium_secretbox_easy',
        ciphertext: 'AAAA',
    }

    it('parses a well-formed envelope', () => {
        const file = makeEnvelopeFile(validEnvelope)
        const result = parseBackupEnvelope(file)
        expect(result).toEqual(validEnvelope)
    })

    it('tolerates leading/trailing whitespace and newlines', () => {
        const file = `\n  ${makeEnvelopeFile(validEnvelope)}\n`
        expect(parseBackupEnvelope(file).version).toBe('1.0')
    })

    const expectReason = (file: string, reason: AsbErrorReason) => {
        try {
            parseBackupEnvelope(file)
            throw new Error('expected AsbImportError')
        } catch (e) {
            expect(e).toBeInstanceOf(AsbImportError)
            expect((e as AsbImportError).reason).toBe(reason)
        }
    }

    it('rejects empty input', () => {
        expectReason('', AsbErrorReason.EmptyFile)
        expectReason('   \n  ', AsbErrorReason.EmptyFile)
    })

    it('rejects non-base64 input that decodes to non-JSON', () => {
        // base64-js silently drops invalid characters, so a string of only
        // illegal chars decodes to empty bytes and the JSON parse step is
        // what catches it. Both NotBase64 and MalformedEnvelope are valid
        // outcomes; the user-facing copy collapses them.
        try {
            parseBackupEnvelope('!!!not-base64!!!')
            throw new Error('expected AsbImportError')
        } catch (e) {
            expect(e).toBeInstanceOf(AsbImportError)
            expect([
                AsbErrorReason.NotBase64,
                AsbErrorReason.MalformedEnvelope,
            ]).toContain((e as AsbImportError).reason)
        }
    })

    it('rejects base64 that does not decode to JSON', () => {
        const file = encodeToBase64(new TextEncoder().encode('not json'))
        expectReason(file, AsbErrorReason.MalformedEnvelope)
    })

    it('rejects JSON missing required fields', () => {
        expectReason(
            makeEnvelopeFile({ version: '1.0', suite: 'whatever' }),
            AsbErrorReason.MalformedEnvelope,
        )
        expectReason(makeEnvelopeFile({}), AsbErrorReason.MalformedEnvelope)
        expectReason(makeEnvelopeFile(null), AsbErrorReason.MalformedEnvelope)
        expectReason(
            makeEnvelopeFile([validEnvelope]),
            AsbErrorReason.MalformedEnvelope,
        )
    })

    it('rejects unsupported version', () => {
        expectReason(
            makeEnvelopeFile({ ...validEnvelope, version: '2.0' }),
            AsbErrorReason.UnsupportedVersion,
        )
    })

    it('rejects unsupported cipher suite', () => {
        expectReason(
            makeEnvelopeFile({
                ...validEnvelope,
                suite: 'AES-GCM:something-else',
            }),
            AsbErrorReason.UnsupportedSuite,
        )
    })
})
