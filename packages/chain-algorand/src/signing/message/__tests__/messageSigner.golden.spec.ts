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

import { beforeEach, describe, expect, it } from 'vitest'
import { signBytes } from 'algosdk'
import nacl from 'tweetnacl'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, concatBytes } from '@perawallet/wallet-core-shared'
import { useAccountChainStateStore } from '@perawallet/wallet-core-accounts'
import { getSelectedScope } from '@perawallet/wallet-core-chain-shared'
import {
    arbitraryDataMessageRequest,
    authDataMessageRequest,
    messageSignerChainAdapters,
    signMessages,
} from '@perawallet/wallet-core-signing'
import { ALGORAND_CHAIN_ID } from '../../../chain-id'
import { algorandMessageSignerAdapter } from '../../adapter'
import {
    messageAccount,
    messageKeyPair,
    signWithMessageKey,
    siwaAuthPayload,
} from './messageFixtures'

// Captured from the signers as they stood before they moved behind the message
// signer adapter, signing with the fixture key. Never regenerate these from
// the current code: they are what a dApp already verifies against.
const GOLDEN_MX_HELLO =
    '16e836a95f180546d5d287d8d3bede40831ea54d3b0407f6a7d9f40bd0715e6026ffd99ea0246ffc1878184da5e2bd6dcde3368cc1bbe393f668f7757934f10b'
const GOLDEN_MX_BINARY =
    'e39466aa93005e283bb0e256331680bcbae6ac1c42e2d6b4137088f847a958ed4510c5ca3f940d007a3e138d79e26e452929ead852e006ddf8c71c39ede8a601'
const GOLDEN_ARC60 =
    'd903bcdef7ab8868c44a3f11356eafd315faea127d0d352848ecd7ec375086f0795fd8fce2b1159c6858fa0c16f5b84a9dffa2f79c7e68807f7b5d75c3faaa0f'

const HELLO = 'aGVsbG8='
const BINARY = 'AAEC/w=='
const bytesOf = (base64: string) =>
    Uint8Array.from(atob(base64), char => char.charCodeAt(0))

const signAll = async (
    requests: ReturnType<typeof arbitraryDataMessageRequest>[],
) =>
    (
        await signMessages(
            requests,
            { account: messageAccount, accounts: [messageAccount] },
            {
                signPayloads: async (_key, payloads) =>
                    signWithMessageKey(payloads),
            },
        )
    ).map(message => bytesToHex(message.signature.bytes))

describe('Algorand message signatures stay byte-identical', () => {
    const scope = getSelectedScope(ALGORAND_CHAIN_ID)

    beforeEach(() => {
        useAccountChainStateStore.getState().resetState()
        messageSignerChainAdapters.reset()
        messageSignerChainAdapters.register(algorandMessageSignerAdapter)
    })

    it('signs MX data as the captured signature and as algosdk.signBytes', async () => {
        const signatures = await signAll([
            arbitraryDataMessageRequest(scope, messageAccount.address, HELLO),
        ])

        expect(signatures).toEqual([GOLDEN_MX_HELLO])
        expect(signatures).toEqual([
            bytesToHex(signBytes(bytesOf(HELLO), messageKeyPair.secretKey)),
        ])
    })

    it('signs an MX batch item by item, in order', async () => {
        const signatures = await signAll([
            arbitraryDataMessageRequest(scope, messageAccount.address, HELLO),
            arbitraryDataMessageRequest(scope, messageAccount.address, BINARY),
        ])

        expect(signatures).toEqual([GOLDEN_MX_HELLO, GOLDEN_MX_BINARY])
        expect(signatures).toEqual(
            [HELLO, BINARY].map(item =>
                bytesToHex(signBytes(bytesOf(item), messageKeyPair.secretKey)),
            ),
        )
    })

    it('signs an ARC-60 request as the captured signature and as the spec derivation', async () => {
        const { authData, metadata } = siwaAuthPayload(messageAccount.address)

        const [signature] = await signMessages(
            [
                authDataMessageRequest(scope, messageAccount.address, {
                    authData,
                    metadata,
                }),
            ],
            { account: messageAccount, accounts: [messageAccount] },
            {
                signPayloads: async (_key, payloads) =>
                    signWithMessageKey(payloads),
            },
        )
        const payload = concatBytes(
            sha256(bytesOf(authData.data)),
            sha256(authData.authenticatorData),
        )

        expect(bytesToHex(signature.signature.bytes)).toBe(GOLDEN_ARC60)
        expect(signature.signature.bytes).toEqual(
            nacl.sign.detached(payload, messageKeyPair.secretKey),
        )
        expect(
            nacl.sign.detached.verify(
                payload,
                signature.signature.bytes,
                messageKeyPair.publicKey,
            ),
        ).toBe(true)
    })
})
