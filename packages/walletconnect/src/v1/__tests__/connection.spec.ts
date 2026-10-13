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
import {
    bridgeUrlFromV1Uri,
    buildWalletConnectV1Connection,
    isWalletConnectV1Connection,
} from '../connection'

describe('bridgeUrlFromV1Uri', () => {
    it('reads the bridge the SDK dials', () => {
        expect(
            bridgeUrlFromV1Uri('wc:t@1?bridge=https%3A%2F%2Fb.example&key=k'),
        ).toBe('https://b.example')
    })

    it('decodes a double-encoded value twice, as the SDK does', () => {
        expect(
            bridgeUrlFromV1Uri(
                'wc:t@1?bridge=https%253A%252F%252Fb.example&key=k',
            ),
        ).toBe('https://b.example')
    })

    it.each([
        [
            'a percent-encoded duplicate key',
            'wc:t@1?bridge=https%3A%2F%2Fb.example&br%69dge=http%3A%2F%2Fevil.example&key=k',
        ],
        ['an empty value', 'wc:t@1?bridge=&key=k'],
        ['no query', 'wc:t@1'],
        ['a malformed escape', 'wc:t@1?bridge=https%3A%2F%2Fb.example%&key=k'],
    ])('returns null for %s', (_label, uri) => {
        expect(bridgeUrlFromV1Uri(uri)).toBeNull()
    })
})

describe('buildWalletConnectV1Connection', () => {
    const baseInput = {
        clientId: 'client-1',
        peer: { name: 'Test dApp', url: 'https://example.com' },
        accounts: ['ADDR'],
        secretRef: 'wc1-session-key:client-1',
        createdAt: 1_000,
        lastActiveAt: 2_000,
        metadata: {
            bridge: 'https://bridge.example',
            handshakeTopic: 'topic-1',
            peerId: 'peer-1',
            chainId: 416_002,
        },
    }

    it('builds the persisted record shape with every optional present', () => {
        const origin = {
            source: 'external-browser' as const,
            browserName: 'safari',
        }

        expect(
            buildWalletConnectV1Connection({
                ...baseInput,
                origin,
                metadata: {
                    ...baseInput.metadata,
                    handshakeId: 7,
                    permissions: ['algo_signTxn'],
                },
            }),
        ).toEqual({
            id: 'client-1',
            kind: 'walletconnect-v1',
            name: 'Test dApp',
            peer: { name: 'Test dApp', url: 'https://example.com' },
            accounts: ['ADDR'],
            secretRef: 'wc1-session-key:client-1',
            status: 'active',
            createdAt: 1_000,
            lastActiveAt: 2_000,
            origin,
            metadata: {
                bridge: 'https://bridge.example',
                handshakeTopic: 'topic-1',
                peerId: 'peer-1',
                chainId: 416_002,
                handshakeId: 7,
                permissions: ['algo_signTxn'],
            },
        })
    })

    it('leaves absent optionals off the record rather than writing undefined', () => {
        const connection = buildWalletConnectV1Connection({
            ...baseInput,
            origin: undefined,
            metadata: {
                ...baseInput.metadata,
                handshakeId: undefined,
                permissions: undefined,
            },
        })

        expect(connection).not.toHaveProperty('origin')
        expect(Object.keys(connection.metadata)).toEqual([
            'bridge',
            'handshakeTopic',
            'peerId',
            'chainId',
        ])
    })

    it('keeps a handshakeId of 0, which the replay guard treats as present', () => {
        const connection = buildWalletConnectV1Connection({
            ...baseInput,
            metadata: { ...baseInput.metadata, handshakeId: 0 },
        })

        expect(connection.metadata.handshakeId).toBe(0)
    })

    it('produces a record the v1 read guard accepts', () => {
        expect(
            isWalletConnectV1Connection(
                buildWalletConnectV1Connection(baseInput),
            ),
        ).toBe(true)
    })
})
