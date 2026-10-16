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

import { describe, it, expect, vi } from 'vitest'
import type {
    MessageRequest,
    SignedMessage,
} from '@perawallet/wallet-core-chain-contract'
import { SIGNING_KEY_DOMAIN } from '../../../../constants'
import { registerFakeMessageSignerAdapter } from '../../../../__tests__/fakeMessageSignerAdapter'
import { TEST_CHAIN_ID, algo25Account } from '../../../../__tests__/accounts'
import {
    CannotSignError,
    InvalidSignableDataError,
} from '../../../../pipeline/errors'
import type { AnalyzedSignableGroup } from '../../../../pipeline/types'
import { signMessageGroups } from '../signMessageGroups'

const SIGNER = 'SIGNER_ADDRESS'
const SCOPE = { chainId: TEST_CHAIN_ID, networkId: 'mainnet' }
const account = algo25Account(SIGNER, { keyPairId: 'key-1' })

const request: MessageRequest = {
    scope: SCOPE,
    method: 'plain',
    signer: SIGNER,
    payload: {},
}

const group = (data: AnalyzedSignableGroup['data']): AnalyzedSignableGroup =>
    ({
        data,
        source: { type: 'walletconnect' },
        signerAddress: SIGNER,
        analysis: { signableAddresses: [SIGNER] },
    }) as unknown as AnalyzedSignableGroup

const messageGroup = () => group({ type: 'message', request })

const signed: SignedMessage = {
    scope: SCOPE,
    signature: {
        requestIndex: 0,
        signer: SIGNER,
        scheme: 'ed25519',
        bytes: new Uint8Array([9, 9]),
    },
}

const keyStore = () => ({ sign: vi.fn(async () => new Uint8Array([1, 2])) })

describe('signMessageGroups', () => {
    it("signs the chain's planned payload under the signer's own key and returns what the chain assembles", async () => {
        const payload = new Uint8Array([5, 5])
        const adapter = registerFakeMessageSignerAdapter({
            plan: vi.fn(() => [
                {
                    requestIndex: 0,
                    signer: SIGNER,
                    scheme: 'ed25519' as const,
                    payload,
                },
            ]),
            assemble: vi.fn(() => signed),
        })
        const kms = keyStore()

        const results = await signMessageGroups({
            groups: [messageGroup()],
            allAccounts: [account],
            scope: SCOPE,
            keyStore: kms,
        })

        expect(kms.sign).toHaveBeenCalledWith(
            'key-1',
            payload,
            SIGNING_KEY_DOMAIN,
        )
        expect(adapter.assemble).toHaveBeenCalledWith(request, [
            expect.objectContaining({
                signer: SIGNER,
                bytes: new Uint8Array([1, 2]),
            }),
        ])
        expect(results).toEqual([
            {
                signedData: { type: 'message', signed },
                signers: [{ address: SIGNER }],
            },
        ])
    })

    it("turns the chain's refusal into a non-retryable invalid-data error and signs nothing", async () => {
        registerFakeMessageSignerAdapter({
            plan: vi.fn(() => {
                throw new Error('The payload is for another network')
            }),
        })
        const kms = keyStore()

        const signing = signMessageGroups({
            groups: [messageGroup()],
            allAccounts: [account],
            scope: SCOPE,
            keyStore: kms,
        })

        await expect(signing).rejects.toBeInstanceOf(InvalidSignableDataError)
        expect(kms.sign).not.toHaveBeenCalled()
    })

    it('refuses a signer the wallet does not hold', async () => {
        registerFakeMessageSignerAdapter()

        const signing = signMessageGroups({
            groups: [messageGroup()],
            allAccounts: [],
            scope: SCOPE,
            keyStore: keyStore(),
        })

        await expect(signing).rejects.toBeInstanceOf(CannotSignError)
    })

    it('refuses a group that carries no message', async () => {
        registerFakeMessageSignerAdapter()

        const signing = signMessageGroups({
            groups: [group({ type: 'arbitrary-data', data: [] })],
            allAccounts: [account],
            scope: SCOPE,
            keyStore: keyStore(),
        })

        await expect(signing).rejects.toBeInstanceOf(InvalidSignableDataError)
    })
})
