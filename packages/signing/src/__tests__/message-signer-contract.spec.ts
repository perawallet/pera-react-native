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

import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type {
    ChainId,
    MessageRequest,
    Signature,
} from '@perawallet/wallet-core-chain-contract'
import type { MessageSignerChainAdapter } from '../message-signer'
import { fakeMessageSignerAdapter } from './fakeMessageSignerAdapter'
import { messageSignerContractTests } from './message-signer-contract'

// A second chain that exists only to pressure-test the contract: one method,
// whose payload is `{ text }` and whose bytes are `'FX' || utf8(text)`.
const FIXTURE_CHAIN_ID = 'fixturehex' as ChainId
const METHOD = 'fixture-text'
const scope = { chainId: FIXTURE_CHAIN_ID, networkId: 'testnet' }

const account = {
    address: 'FIXTURE_ACCOUNT',
    keyPairId: 'fixture-key',
    custody: { kind: 'local', seed: null },
} as unknown as WalletAccount

const readText = (request: MessageRequest): string => {
    const { payload } = request
    if (
        typeof payload !== 'object' ||
        payload === null ||
        typeof (payload as { text?: unknown }).text !== 'string'
    ) {
        throw new Error('malformed fixture payload')
    }
    return (payload as { text: string }).text
}

const fixtureAdapter: MessageSignerChainAdapter = {
    ...fakeMessageSignerAdapter(),
    chainId: FIXTURE_CHAIN_ID,
    supports: method => method === METHOD,
    describe: request => {
        const title = { key: 'fixture.message' }
        try {
            return { kind: 'text', title, preview: readText(request) }
        } catch {
            return { kind: 'raw', title }
        }
    },
    plan: (request, context) => {
        if (request.method !== METHOD) {
            throw new Error('unsupported fixture method')
        }
        if (request.signer !== context.account.address) {
            throw new Error('not the account')
        }
        return [
            {
                requestIndex: 0,
                signer: context.account.address,
                scheme: 'ed25519',
                payload: new TextEncoder().encode(`FX${readText(request)}`),
            },
        ]
    },
    assemble: (request, signatures: Signature[]) => {
        const [signature] = signatures
        if (signatures.length !== 1 || signature.signer !== request.signer) {
            throw new Error('one signature, from the signer')
        }
        return { scope: request.scope, signature }
    },
}

messageSignerContractTests(() => fixtureAdapter, {
    scope,
    account,
    accounts: [account],
    requests: [
        {
            scope,
            method: METHOD,
            signer: account.address,
            payload: { text: 'hello' },
        },
    ],
    malformedRequest: {
        scope,
        method: METHOD,
        signer: account.address,
        payload: { text: 7 },
    },
    unsupportedMethod: 'fixture-unknown',
    otherSigner: 'FIXTURE_OTHER',
    sign: request => request.payload.slice().reverse(),
})
