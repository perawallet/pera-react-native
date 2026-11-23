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
import { parseSiweMessage } from '../siwe'

const ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

const siwe = ({
    header = 'opensea.io wants you to sign in with your Ethereum account:',
    statement = 'Click to sign in and accept the OpenSea Terms of Service.',
    fields = [
        'URI: https://opensea.io/',
        'Version: 1',
        'Chain ID: 1',
        'Nonce: 3fp8w2kd',
        'Issued At: 2026-11-20T10:00:00.000Z',
        'Expiration Time: 2026-11-21T10:00:00.000Z',
    ],
}: { header?: string; statement?: string; fields?: string[] } = {}) =>
    [header, ADDRESS, '', statement, '', ...fields].join('\n')

describe('parseSiweMessage', () => {
    it('reads every field of a valid message', () => {
        expect(
            parseSiweMessage(
                siwe({
                    fields: [
                        'URI: https://opensea.io/',
                        'Version: 1',
                        'Chain ID: 1',
                        'Nonce: 3fp8w2kd',
                        'Issued At: 2026-11-20T10:00:00.000Z',
                        'Expiration Time: 2026-11-21T10:00:00.000Z',
                        'Not Before: 2026-11-20T10:00:00.000Z',
                        'Request ID: 42',
                        'Resources:',
                        '- ipfs://bafy',
                        '- https://opensea.io/terms',
                    ],
                }),
            ),
        ).toEqual({
            domain: 'opensea.io',
            address: ADDRESS,
            statement:
                'Click to sign in and accept the OpenSea Terms of Service.',
            uri: 'https://opensea.io/',
            version: '1',
            chainId: '1',
            nonce: '3fp8w2kd',
            issuedAt: '2026-11-20T10:00:00.000Z',
            expirationTime: '2026-11-21T10:00:00.000Z',
            notBefore: '2026-11-20T10:00:00.000Z',
            requestId: '42',
            resources: ['ipfs://bafy', 'https://opensea.io/terms'],
        })
    })

    it('reads the domain after an optional scheme, with its port', () => {
        expect(
            parseSiweMessage(
                siwe({
                    header: 'https://localhost:3000 wants you to sign in with your Ethereum account:',
                }),
            )?.domain,
        ).toBe('localhost:3000')
    })

    it('reads a message without a statement or optional fields', () => {
        const text = [
            'app.example wants you to sign in with your Ethereum account:',
            ADDRESS,
            '',
            'URI: https://app.example',
            'Version: 1',
            'Chain ID: 8453',
            'Nonce: abc12345',
            'Issued At: 2026-11-20T10:00:00Z',
            '',
        ].join('\n')

        const parsed = parseSiweMessage(text)

        expect(parsed).toMatchObject({ domain: 'app.example', chainId: '8453' })
        expect(parsed).not.toHaveProperty('statement')
        expect(parsed).not.toHaveProperty('expirationTime')
    })

    it.each([
        ['the nonce', 'Nonce: 3fp8w2kd'],
        ['the issued-at time', 'Issued At: 2026-11-20T10:00:00.000Z'],
        ['the chain id', 'Chain ID: 1'],
        ['the URI', 'URI: https://opensea.io/'],
        ['the version', 'Version: 1'],
    ])('is not a sign-in message without %s', (_label, missing) => {
        const fields = siwe()
            .split('\n')
            .filter(line => line !== missing)
        expect(parseSiweMessage(fields.join('\n'))).toBeUndefined()
    })

    it.each([
        ['plain text', 'Sign in to Pera'],
        [
            'another chain family',
            siwe({
                header: 'opensea.io wants you to sign in with your Solana account:',
            }),
        ],
        ['an unknown field', siwe({ fields: ['URI: x', 'Colour: red'] })],
        [
            'a repeated field',
            siwe({
                fields: [
                    'URI: https://opensea.io/',
                    'Version: 1',
                    'Chain ID: 1',
                    'Chain ID: 8453',
                    'Nonce: 3fp8w2kd',
                    'Issued At: 2026-11-20T10:00:00.000Z',
                ],
            }),
        ],
        [
            'a non-numeric chain id',
            siwe({
                fields: [
                    'URI: https://opensea.io/',
                    'Version: 1',
                    'Chain ID: base',
                    'Nonce: 3fp8w2kd',
                    'Issued At: 2026-11-20T10:00:00.000Z',
                ],
            }),
        ],
        [
            'an unreadable expiry',
            siwe({
                fields: [
                    'URI: https://opensea.io/',
                    'Version: 1',
                    'Chain ID: 1',
                    'Nonce: 3fp8w2kd',
                    'Issued At: 2026-11-20T10:00:00.000Z',
                    'Expiration Time: tomorrow',
                ],
            }),
        ],
        [
            'a second line that is not an address',
            siwe().replace(ADDRESS, 'not-an-address'),
        ],
    ])('is not a sign-in message for %s', (_label, text) => {
        expect(parseSiweMessage(text)).toBeUndefined()
    })
})
