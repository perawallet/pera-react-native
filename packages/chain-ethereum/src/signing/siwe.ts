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

// The scheme before the domain is optional in EIP-4361.
const HEADER =
    /^(?:[a-zA-Z][a-zA-Z0-9+.-]*:\/\/)?(\S+) wants you to sign in with your Ethereum account:$/

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
const RESOURCES = 'Resources:'
const RESOURCE_PREFIX = '- '

const isDateOrAbsent = (value: Optional<string>): boolean =>
    value === undefined || !Number.isNaN(Date.parse(value))

/**
 * Reads an EIP-4361 (Sign-In with Ethereum) message. Text that strays from the
 * format, or lacks a field the EIP requires, is not a sign-in message and
 * returns undefined, so it reviews as plain text.
 */
export const parseSiweMessage = (text: string): Optional<SiwxMessage> => {
    const lines = text.split('\n')
    while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
    const domain = HEADER.exec(lines[0] ?? '')?.[1]
    const address = lines[1]
    if (!domain || !address || !isAddress(address, { strict: false })) {
        return undefined
    }
    const uriLine = lines.findIndex(line => line.startsWith('URI: '))
    if (uriLine < 2) return undefined
    const statement = lines
        .slice(2, uriLine)
        .filter(line => line !== '')
        .join('\n')

    const fields = new Map<FieldKey, string>()
    let resources: Optional<string[]>
    for (const line of lines.slice(uriLine)) {
        if (resources) {
            if (!line.startsWith(RESOURCE_PREFIX)) return undefined
            resources.push(line.slice(RESOURCE_PREFIX.length))
            continue
        }
        if (line === RESOURCES) {
            resources = []
            continue
        }
        const separator = line.indexOf(': ')
        const name = line.slice(0, separator)
        if (separator < 0 || !isFieldName(name)) return undefined
        const key = FIELD_KEYS[name]
        // A repeated field would let the review show one value while the
        // dApp's verifier reads the other.
        if (fields.has(key)) return undefined
        fields.set(key, line.slice(separator + 2))
    }

    const uri = fields.get('uri')
    const version = fields.get('version')
    const chainId = fields.get('chainId')
    const nonce = fields.get('nonce')
    const issuedAt = fields.get('issuedAt')
    const expirationTime = fields.get('expirationTime')
    const notBefore = fields.get('notBefore')
    const requestId = fields.get('requestId')
    if (
        !uri ||
        version !== '1' ||
        !chainId ||
        !DIGITS.test(chainId) ||
        !nonce ||
        !issuedAt ||
        !isDateOrAbsent(issuedAt) ||
        !isDateOrAbsent(expirationTime) ||
        !isDateOrAbsent(notBefore)
    ) {
        return undefined
    }
    return {
        domain,
        address,
        uri,
        version,
        chainId,
        nonce,
        issuedAt,
        ...(statement !== '' && { statement }),
        ...(expirationTime !== undefined && { expirationTime }),
        ...(notBefore !== undefined && { notBefore }),
        ...(requestId !== undefined && { requestId }),
        ...(resources && { resources }),
    }
}
