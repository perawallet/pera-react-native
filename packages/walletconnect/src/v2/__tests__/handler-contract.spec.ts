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

import { beforeEach, vi } from 'vitest'
import { MemoryKeyValueStorage } from '@perawallet/wallet-extension-platform'
import {
    runHandlerContractTests,
    type HandlerContractPeer,
} from '@perawallet/wallet-core-connections/testing'
import type { ConnectionHandler } from '@perawallet/wallet-core-connections'
import { Networks, type Nullable } from '@perawallet/wallet-core-shared'
import { createWalletConnectV2Handler } from '../handler'
import {
    ADDRESS,
    createFakeWalletKit,
    makeProposal,
    makeRequest,
    SYM_KEY,
    V1_URI,
    V2_URI,
    type FakeWalletKit,
} from './fakeWalletKit'

// Same stand-in as the v1 handler spec: the connections barrel reaches the
// provider, whose keystore migration ledger imports react-native-mmkv at
// module scope and has no JS fallback under jsdom.
vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        keyValueStorage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
        },
    }),
}))

// The suite builds a handler per case and the peer is one shared object, so
// the fixture follows whichever WalletKit is currently live — the same
// indirection the origin-identified fixture uses for its page.
const live: { walletKit: Nullable<FakeWalletKit> } = { walletKit: null }
const unreachable = new Set<string>()

const makeHandler = (): ConnectionHandler => {
    // A fresh fake per call, mirroring handler.spec's two-fake coverage, so
    // "initialize then teardown is safe and repeatable" exercises a real
    // rebuild rather than reusing one client across both initializations.
    const createWalletKit = async () => {
        const walletKit = createFakeWalletKit()
        // Delivery is the fallible send the contract's reachability case
        // needs, scoped per session topic rather than per client.
        walletKit.respondSessionRequest.mockImplementation(
            async ({ topic }) => {
                if (unreachable.has(topic)) {
                    throw new Error(`the peer on ${topic} is unreachable`)
                }
            },
        )
        live.walletKit = walletKit
        return walletKit
    }
    return createWalletConnectV2Handler({
        getNetwork: () => Networks.mainnet,
        projectId: 'test-project-id',
        keyValueStorage: new MemoryKeyValueStorage(),
        createWalletKit,
    })
}

const requireWalletKit = (): FakeWalletKit => {
    if (!live.walletKit) throw new Error('no WalletKit is live')
    return live.walletKit
}

const peer: HandlerContractPeer = {
    propose: pairingId => {
        if (pairingId === undefined) {
            throw new Error('the v2 handler always pairs before it proposes')
        }
        // On the pairing the handler resolved `pair()` with, and never on the
        // session topic: the two are different strings on v2.
        requireWalletKit().emit(
            'session_proposal',
            makeProposal({ pairingTopic: pairingId }),
        )
    },
    request: connectionId => {
        requireWalletKit().emit(
            'session_request',
            makeRequest({ topic: connectionId }),
        )
    },
    setReachable: (connectionId, isReachable) => {
        if (isReachable) unreachable.delete(connectionId)
        else unreachable.add(connectionId)
    },
}

beforeEach(() => {
    live.walletKit = null
    unreachable.clear()
})

runHandlerContractTests('walletconnect-v2', makeHandler, {
    uri: { valid: V2_URI, foreign: V1_URI, secret: SYM_KEY },
    // A real Algorand address: the approved namespace's CAIP-10 accounts are
    // parsed back out, and a placeholder would leave the session authorised
    // for nothing this wallet can sign for.
    accounts: [ADDRESS],
    peer,
})
