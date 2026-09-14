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
import type { Connection } from '@perawallet/wallet-extension-connections'
import {
    WALLET_CONNECT_V2_KIND,
    isV2PairingUri,
    isWalletConnectV2Connection,
} from '../connection'

const TOPIC = 'b'.repeat(64)

const VALID_METADATA = {
    topic: TOPIC,
    chains: ['algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k'],
    methods: ['algo_signTxn'],
    expiry: 1_800_000_000,
}

const makeRecord = (overrides: Partial<Connection> = {}): Connection => ({
    id: 'connection-1',
    kind: WALLET_CONNECT_V2_KIND,
    name: 'Test dApp',
    peer: { name: 'Test dApp' },
    accounts: ['NEVERMINDTHEADDRESS'],
    status: 'active',
    createdAt: 1_700_000_000_000,
    lastActiveAt: 1_700_000_000_000,
    metadata: { ...VALID_METADATA },
    ...overrides,
})

describe('isWalletConnectV2Connection', () => {
    it('accepts a well-formed v2 record', () => {
        expect(isWalletConnectV2Connection(makeRecord())).toBe(true)
    })

    it('rejects another kind carrying v2-shaped metadata', () => {
        expect(
            isWalletConnectV2Connection(
                makeRecord({ kind: 'walletconnect-v1' }),
            ),
        ).toBe(false)
    })

    it('rejects a record with no metadata at all', () => {
        expect(
            isWalletConnectV2Connection(makeRecord({ metadata: undefined })),
        ).toBe(false)
    })

    it('rejects a missing topic', () => {
        const { topic: _topic, ...rest } = VALID_METADATA
        expect(
            isWalletConnectV2Connection(makeRecord({ metadata: rest })),
        ).toBe(false)
    })

    it('rejects a non-array chains', () => {
        expect(
            isWalletConnectV2Connection(
                makeRecord({
                    metadata: {
                        ...VALID_METADATA,
                        chains: 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k',
                    },
                }),
            ),
        ).toBe(false)
    })

    it('rejects a chains array holding a non-string entry', () => {
        expect(
            isWalletConnectV2Connection(
                makeRecord({
                    metadata: { ...VALID_METADATA, chains: [416_001] },
                }),
            ),
        ).toBe(false)
    })

    it('rejects a non-array methods', () => {
        expect(
            isWalletConnectV2Connection(
                makeRecord({
                    metadata: { ...VALID_METADATA, methods: 'algo_signTxn' },
                }),
            ),
        ).toBe(false)
    })

    it('rejects a half-written record with no expiry', () => {
        const { expiry: _expiry, ...rest } = VALID_METADATA
        expect(
            isWalletConnectV2Connection(makeRecord({ metadata: rest })),
        ).toBe(false)
    })

    it('rejects an empty topic', () => {
        // The topic addresses every relay publish; an empty one is a
        // half-written row, not a session that can be answered.
        expect(
            isWalletConnectV2Connection(
                makeRecord({ metadata: { ...VALID_METADATA, topic: '' } }),
            ),
        ).toBe(false)
    })

    it('rejects a NaN expiry', () => {
        // `Number(undefined)` from a bad transform is still `typeof number`,
        // and every expiry comparison against it silently reads as "live".
        expect(
            isWalletConnectV2Connection(
                makeRecord({ metadata: { ...VALID_METADATA, expiry: NaN } }),
            ),
        ).toBe(false)
    })

    it('rejects a record carrying a secretRef', () => {
        // WalletKit owns the symKey, so a v2 record holding key material is
        // either a mis-migrated v1 row or corruption — never usable.
        expect(
            isWalletConnectV2Connection(
                makeRecord({ secretRef: 'keystore-entry-1' }),
            ),
        ).toBe(false)
    })
})

describe('isV2PairingUri', () => {
    it('accepts a v2 pairing URI', () => {
        expect(
            isV2PairingUri(
                `wc:${TOPIC}@2?relay-protocol=irn&symKey=${'0'.repeat(64)}`,
            ),
        ).toBe(true)
    })

    it('rejects a v1 pairing URI', () => {
        expect(
            isV2PairingUri(
                `wc:${TOPIC}@1?bridge=https%3A%2F%2Fbridge.walletconnect.org&key=${'0'.repeat(64)}`,
            ),
        ).toBe(false)
    })

    it('rejects a bare focus hint with no topic or version', () => {
        expect(isV2PairingUri('wc://?browser=safari')).toBe(false)
    })

    it('rejects a v2 URI with no symKey', () => {
        expect(isV2PairingUri(`wc:${TOPIC}@2?relay-protocol=irn`)).toBe(false)
    })

    it('rejects a URI with an empty symKey', () => {
        expect(isV2PairingUri(`wc:${TOPIC}@2?relay-protocol=irn&symKey=`)).toBe(
            false,
        )
    })

    it('rejects something that is not a wc URI', () => {
        expect(isV2PairingUri('https://perawallet.app')).toBe(false)
    })

    it('ignores a symKey that only appears in the fragment', () => {
        // Nothing reads a `wc:` fragment, so a URI whose only symKey sits
        // there has no pairing secret and cannot pair.
        expect(
            isV2PairingUri(
                `wc:${TOPIC}@2?relay-protocol=irn#symKey=${'0'.repeat(64)}`,
            ),
        ).toBe(false)
    })

    it('accepts a symKey in the query of a URI that also has a fragment', () => {
        expect(
            isV2PairingUri(
                `wc:${TOPIC}@2?relay-protocol=irn&symKey=${'0'.repeat(64)}#ignored`,
            ),
        ).toBe(true)
    })
})
