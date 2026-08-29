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

// @vitest-environment node

import { describe, it, expect, vi } from 'vitest'
import {
    CannotSignError,
    NoLocalParticipantsError,
    SourceError,
    TransportError,
    UserCancelledError,
} from '@perawallet/wallet-core-signing'

import { sanitizeErrorForWebview } from '../handlers-shared'

// The global blockchain mock in vitest.setup.ts is a hand-written object and
// does not carry Arc0001Error. Reach for the real class by module path — the
// point of these tests is that the allowlist matches the names production
// actually produces, so a stand-in would defeat them.
const { Arc0001Error } = await vi.importActual<
    typeof import('../../../../../../../packages/blockchain/src/arc0001/errors')
>('../../../../../../../packages/blockchain/src/arc0001/errors')
const { Arc0001ErrorCode } = await vi.importActual<
    typeof import('../../../../../../../packages/blockchain/src/arc0001/types')
>('../../../../../../../packages/blockchain/src/arc0001/types')

const GENERIC = 'An error occurred during signing'

describe('WEBVIEW_SAFE_ERROR_NAMES pinning', () => {
    // The allowlist matches on `error.name`, so it is only correct while these
    // names match what the real classes produce. If a class is renamed, this
    // fails loudly here instead of silently dropping to generic copy in prod.
    it('pins the names the allowlist relies on', () => {
        expect(new Arc0001Error(Arc0001ErrorCode.InvalidInput, 'x').name).toBe(
            'Arc0001Error',
        )
        expect(new UserCancelledError().name).toBe('UserCancelledError')
    })

    it('pins the names of the classes that must stay withheld', () => {
        expect(new TransportError('x').name).toBe('TransportError')
        expect(new SourceError('x').name).toBe('SourceError')
        expect(new CannotSignError('addr').name).toBe('CannotSignError')
        expect(new NoLocalParticipantsError('addr').name).toBe(
            'NoLocalParticipantsError',
        )
    })
})

describe('sanitizeErrorForWebview', () => {
    it('relays Arc0001Error, which the protocol requires to carry a message', () => {
        const error = new Arc0001Error(
            Arc0001ErrorCode.Unauthorized,
            'the wallet cannot sign any of the requested transactions',
        )

        expect(sanitizeErrorForWebview(error)).toBe(
            'the wallet cannot sign any of the requested transactions',
        )
    })

    it('relays UserCancelledError, a fixed literal', () => {
        expect(sanitizeErrorForWebview(new UserCancelledError())).toBe(
            'User cancelled the operation',
        )
    })

    it('withholds third-party text wrapped by TransportError', () => {
        // The leak this guards: TransportError(err.message, err) passes upstream
        // text through verbatim, which may carry a node URL or other
        // infrastructure detail.
        const error = new TransportError(
            'connect ECONNREFUSED https://internal-algod.pera.internal:8080',
        )

        expect(sanitizeErrorForWebview(error)).toBe(GENERIC)
    })

    it('withholds third-party text wrapped by SourceError', () => {
        const error = new SourceError('unexpected token < in JSON at /var/lib')

        expect(sanitizeErrorForWebview(error)).toBe(GENERIC)
    })

    it('withholds wallet-held addresses interpolated by CannotSignError', () => {
        // Arc0001Error's docblock forbids sending held addresses to a remote
        // peer; passing every AppError through violated that.
        const address =
            'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
        const error = new CannotSignError(address, 'rekeyed elsewhere')

        expect(sanitizeErrorForWebview(error)).not.toContain(address)
        expect(sanitizeErrorForWebview(error)).toBe(GENERIC)
    })

    it('withholds multisig participant addresses', () => {
        const address =
            'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'

        expect(
            sanitizeErrorForWebview(new NoLocalParticipantsError(address)),
        ).toBe(GENERIC)
    })

    it('withholds a plain Error, which may carry a stack or path', () => {
        expect(
            sanitizeErrorForWebview(new Error('/Users/someone/app/secret.ts')),
        ).toBe(GENERIC)
    })

    it('truncates a relayed message at 200 characters', () => {
        const error = new Arc0001Error(
            Arc0001ErrorCode.InvalidInput,
            'x'.repeat(500),
        )

        expect(sanitizeErrorForWebview(error)).toHaveLength(200)
    })
})
