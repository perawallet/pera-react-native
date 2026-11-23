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

import { isAddress } from 'viem'
import type { SiwxMessage } from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'

// The scheme before the domain is optional in EIP-4361. Any non-space domain
// matches, so a malformed one still reviews as a sign-in; `AUTHORITY` holds it
// to the host[:port] form verifiers accept.
const HEADER =
    /^(?:[a-zA-Z][a-zA-Z0-9+.-]*:\/\/)?(\S+) wants you to sign in with your Ethereum account:$/
const AUTHORITY = /^[a-zA-Z0-9+.-]+(?::\d{1,5})?$/

const FIELD_KEYS = {
    URI: 'uri',
    Version: 'version',
    'Chain ID': 'chainId',
    Nonce: 'nonce',
    'Issued At': 'issuedAt',
    'Expiration Time': 'expirationTime',
    'Not Before': 'notBefore',
    'Request ID': 'requestId',
} as const satisfies Record<string, keyof SiwxMessage>

type FieldName = keyof typeof FIELD_KEYS
type FieldKey = (typeof FIELD_KEYS)[FieldName]

const isFieldName = (name: string): name is FieldName =>
    Object.hasOwn(FIELD_KEYS, name)

const DIGITS = /^\d+$/
// RFC 3339, as EIP-4361 requires; `Date.parse` alone accepts looser forms.
const DATE_TIME =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/
const RESOURCES = 'Resources:'
const RESOURCE_PREFIX = '- '
const DATE_KEYS = ['issuedAt', 'expirationTime', 'notBefore'] as const

const isDateTime = (value: string): boolean =>
    DATE_TIME.test(value) && !Number.isNaN(Date.parse(value))

export type ParsedSiweMessage = {
    message: SiwxMessage
    /** The text strays from EIP-4361, so a verifier may read it differently than `message`. */
    isMalformed: boolean
}

/**
 * Reads an EIP-4361 (Sign-In with Ethereum) message; text without its header
 * line returns undefined. Past the header, text that strays from the format is
 * read as far as it goes and marked `isMalformed` rather than dropped: lenient
 * verifiers still accept it, so its domain and resources must be checked.
 */
export const parseSiweMessage = (text: string): Optional<ParsedSiweMessage> => {
    // Verifiers tolerate CRLF and trailing whitespace, so neither is malformed.
    const lines = text.split(/\r?\n/).map(line => line.trimEnd())
    while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
    const domain = HEADER.exec(lines[0] ?? '')?.[1]
    if (!domain) return undefined

    let isMalformed = !AUTHORITY.test(domain)
    const address = lines[1] ?? ''
    if (!isAddress(address, { strict: false })) isMalformed = true
    let uriLine = lines.findIndex(line => line.startsWith('URI: '))
    if (uriLine < 2) {
        isMalformed = true
        uriLine = lines.length
    }
    const statement = lines
        .slice(2, uriLine)
        .filter(line => line !== '')
        .join('\n')

    const fields = new Map<FieldKey, string>()
    let resources: Optional<string[]>
    for (const line of lines.slice(uriLine)) {
        // Every `- ` line past `Resources:` is kept, so no capability a
        // lenient verifier might read escapes the review.
        if (resources) {
            if (line.startsWith(RESOURCE_PREFIX)) {
                resources.push(line.slice(RESOURCE_PREFIX.length))
            } else {
                isMalformed = true
            }
            continue
        }
        if (line === RESOURCES) {
            resources = []
            continue
        }
        const separator = line.indexOf(': ')
        const name = line.slice(0, separator)
        // A repeated field would let the review show one value while the
        // dApp's verifier reads the other.
        if (
            separator < 0 ||
            !isFieldName(name) ||
            fields.has(FIELD_KEYS[name])
        ) {
            isMalformed = true
            continue
        }
        fields.set(FIELD_KEYS[name], line.slice(separator + 2))
    }

    const uri = fields.get('uri') ?? ''
    const version = fields.get('version') ?? ''
    const chainId = fields.get('chainId') ?? ''
    const nonce = fields.get('nonce')
    const requestId = fields.get('requestId')
    const [issuedAt, expirationTime, notBefore] = DATE_KEYS.map(key => {
        const value = fields.get(key)
        if (value === undefined || isDateTime(value)) return value
        isMalformed = true
        return undefined
    })
    if (
        !uri ||
        version !== '1' ||
        !DIGITS.test(chainId) ||
        !nonce ||
        !issuedAt
    ) {
        isMalformed = true
    }
    return {
        message: {
            domain,
            address,
            uri,
            version,
            chainId,
            ...(nonce !== undefined && { nonce }),
            ...(issuedAt !== undefined && { issuedAt }),
            ...(statement !== '' && { statement }),
            ...(expirationTime !== undefined && { expirationTime }),
            ...(notBefore !== undefined && { notBefore }),
            ...(requestId !== undefined && { requestId }),
            ...(resources && { resources }),
        },
        isMalformed,
    }
}
