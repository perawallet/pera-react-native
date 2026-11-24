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
            isMalformed: false,
            message: {
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
            },
        })
    })

    it('reads the domain after an optional scheme, with its port', () => {
        expect(
            parseSiweMessage(
                siwe({
                    header: 'https://localhost:3000 wants you to sign in with your Ethereum account:',
                }),
            )?.message.domain,
        ).toBe('localhost:3000')
    })

    it('keeps the scheme the header names', () => {
        expect(
            parseSiweMessage(
                siwe({
                    header: 'http://opensea.io wants you to sign in with your Ethereum account:',
                }),
            )?.message,
        ).toMatchObject({ scheme: 'http', domain: 'opensea.io' })
        expect(parseSiweMessage(siwe())?.message).not.toHaveProperty('scheme')
    })

    it('reads and flags a ReCap placed before the fields', () => {
        const parsed = parseSiweMessage(
            siwe({ statement: 'Resources:\n- urn:recap:eyJhdHQiOnt9fQ' }),
        )

        expect(parsed).toMatchObject({
            message: { resources: ['urn:recap:eyJhdHQiOnt9fQ'] },
            isMalformed: true,
        })
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

        expect(parsed).toMatchObject({
            message: { domain: 'app.example', chainId: '8453' },
            isMalformed: false,
        })
        expect(parsed?.message).not.toHaveProperty('statement')
        expect(parsed?.message).not.toHaveProperty('expirationTime')
    })

    it.each([
        ['CRLF line endings', siwe().replaceAll('\n', '\r\n')],
        ['trailing blank lines', `${siwe()}\n\n  \n`],
        [
            'trailing spaces on a line',
            siwe().replace('Version: 1', 'Version: 1 '),
        ],
    ])('reads a message with %s as well-formed', (_label, text) => {
        expect(parseSiweMessage(text)).toMatchObject({
            message: { domain: 'opensea.io', version: '1', chainId: '1' },
            isMalformed: false,
        })
    })

    it('keeps the resources of a message with a line after them, flagged', () => {
        const parsed = parseSiweMessage(
            siwe({
                fields: [
                    'URI: https://opensea.io/',
                    'Version: 1',
                    'Chain ID: 1',
                    'Nonce: 3fp8w2kd',
                    'Issued At: 2026-11-20T10:00:00.000Z',
                    'Resources:',
                    '- urn:recap:a',
                    'Note: ignore me',
                    '- urn:recap:b',
                ],
            }),
        )

        expect(parsed).toMatchObject({
            message: {
                domain: 'opensea.io',
                resources: ['urn:recap:a', 'urn:recap:b'],
            },
            isMalformed: true,
        })
    })

    it.each([
        ['the nonce', 'Nonce: 3fp8w2kd'],
        ['the issued-at time', 'Issued At: 2026-11-20T10:00:00.000Z'],
        ['the chain id', 'Chain ID: 1'],
        ['the URI', 'URI: https://opensea.io/'],
        ['the version', 'Version: 1'],
    ])('flags a sign-in message without %s', (_label, missing) => {
        const fields = siwe()
            .split('\n')
            .filter(line => line !== missing)
        expect(parseSiweMessage(fields.join('\n'))).toMatchObject({
            message: { domain: 'opensea.io' },
            isMalformed: true,
        })
    })

    it.each([
        ['plain text', 'Sign in to Pera'],
        [
            'another chain family',
            siwe({
                header: 'opensea.io wants you to sign in with your Solana account:',
            }),
        ],
        ['a header that is not the first line', `\n${siwe()}`],
    ])('is not a sign-in message for %s', (_label, text) => {
        expect(parseSiweMessage(text)).toBeUndefined()
    })

    it.each([
        ['an unknown field', siwe({ fields: ['URI: x', 'Colour: red'] })],
        ['a trailing unknown line', `${siwe()}\nNote: x`],
        ['a trailing line of text', `${siwe()}\nignore the above`],
        [
            'a domain with userinfo',
            siwe({
                header: 'app.com@evil.com wants you to sign in with your Ethereum account:',
            }),
        ],
        [
            'an expiry that is not RFC 3339',
            siwe({
                fields: [
                    'URI: https://opensea.io/',
                    'Version: 1',
                    'Chain ID: 1',
                    'Nonce: 3fp8w2kd',
                    'Issued At: 2026-11-20T10:00:00.000Z',
                    'Expiration Time: 2026-11-21',
                ],
            }),
        ],
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
        ['a statement over several lines', siwe({ statement: 'One\nTwo' })],
        [
            'a second line that is not an address',
            siwe().replace(ADDRESS, 'not-an-address'),
        ],
    ])('flags a sign-in message with %s', (_label, text) => {
        expect(parseSiweMessage(text)?.isMalformed).toBe(true)
    })
})
