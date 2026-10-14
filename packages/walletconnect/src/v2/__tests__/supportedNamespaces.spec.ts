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

import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryKeyValueStorage } from '@perawallet/wallet-extension-platform/test-utils'
import { memoryStore } from '@perawallet/wallet-core-connections/testing'
import type {
    ConnectionHandlerContext,
    ConnectionProposal,
} from '@perawallet/wallet-core-connections'
import {
    dappRequestChainAdapters,
    type DappRequestChainAdapter,
} from '@perawallet/wallet-core-connections/dappRequest'
import { Networks } from '@perawallet/wallet-core-shared'
import { dappRequestAdapterFor } from '../../shared/chainSupport'
import type { WalletKitFactory } from '../client'
import { createWalletConnectV2Handler } from '../handler'
import {
    ADDRESS,
    createFakeWalletKit,
    flush,
    MAINNET_CHAIN_ID,
    makeProposal,
} from './fakeWalletKit'

const sdk = vi.hoisted(() => ({
    buildApprovedNamespaces: undefined as unknown as ReturnType<typeof vi.fn>,
}))

vi.mock('../sdk', async importOriginal => {
    const original = await importOriginal<typeof import('../sdk')>()
    return {
        loadWalletConnectSdk: async () => {
            const loaded = await original.loadWalletConnectSdk()
            sdk.buildApprovedNamespaces = vi.fn(loaded.buildApprovedNamespaces)
            return {
                ...loaded,
                buildApprovedNamespaces: sdk.buildApprovedNamespaces,
            }
        },
    }
})

// Same stand-in as the other v2 specs: the connections barrel reaches the
// provider, which imports react-native-mmkv at module scope.
vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        keyValueStorage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
        },
    }),
}))

const algorandAdapter = dappRequestAdapterFor(Networks.mainnet)
if (!algorandAdapter) {
    throw new Error('the package setup file registers the Algorand adapter')
}

const FIXTURE_CHAIN_ID = 'fx:1'

const fixtureAdapter = (
    v2: DappRequestChainAdapter['walletConnect']['v2'],
): DappRequestChainAdapter => ({
    chainId: 'ethereum',
    relayableErrorNames: [],
    accountTypeOf: () => 'Fixture',
    parseSigningParams: () => ({
        ok: false,
        reason: 'missing',
        message: 'Missing payload',
    }),
    resolveReportedNetwork: () => undefined,
    emptySignaturesFor: () => ({}),
    walletConnect: {
        namespace: 'fx',
        caip2ChainIdFor: () => FIXTURE_CHAIN_ID,
        networkForCaip2ChainId: caip2 =>
            caip2 === FIXTURE_CHAIN_ID ? 'fx-main' : null,
        toWireResult: () => null,
        ...(v2 ? { v2 } : {}),
    },
    validateTransactionPayload: () => ({ ok: false, message: 'Unused' }),
    useEnqueueTransactionSigning: () => async () => null,
})

const FIXTURE_V2 = {
    methods: ['fx_sign'],
    signingMethods: ['fx_sign'],
    handleRequest: () => ({ kind: 'unsupported' as const }),
}

afterEach(() => {
    dappRequestChainAdapters.reset()
    dappRequestChainAdapters.register(algorandAdapter)
})

const approveProposal = async (
    overrides: Parameters<typeof makeProposal>[0] = {},
): Promise<Record<string, unknown>> => {
    const walletKit = createFakeWalletKit()
    const handler = createWalletConnectV2Handler({
        getNetwork: () => Networks.mainnet,
        projectId: 'a-reown-project-id',
        keyValueStorage: new MemoryKeyValueStorage(),
        createWalletKit: vi.fn<WalletKitFactory>(async () => walletKit),
    })
    let proposal: ConnectionProposal | undefined
    await handler.initialize({
        store: memoryStore(),
        onProposal: received => {
            proposal = received
        },
        onMessage: vi.fn<ConnectionHandlerContext['onMessage']>(),
        onDisconnected: vi.fn<ConnectionHandlerContext['onDisconnected']>(),
        onRequestExpired: vi.fn<ConnectionHandlerContext['onRequestExpired']>(),
        onError: vi.fn<ConnectionHandlerContext['onError']>(),
    })
    walletKit.emit('session_proposal', makeProposal(overrides))
    await flush()
    if (!proposal) throw new Error('no proposal surfaced')

    await proposal.approve([ADDRESS])
    await handler.teardown()

    const [[{ supportedNamespaces }]] = sdk.buildApprovedNamespaces.mock
        .calls as [[{ supportedNamespaces: Record<string, unknown> }]]
    return supportedNamespaces
}

const WITH_FIXTURE_CHAIN = {
    optionalNamespaces: {
        fx: { chains: [FIXTURE_CHAIN_ID], methods: [], events: [] },
    },
}

describe('the namespaces a v2 session is offered', () => {
    it('offers only the chains the dApp asked for', async () => {
        dappRequestChainAdapters.register(fixtureAdapter(FIXTURE_V2))

        const supported = await approveProposal()

        expect(Object.keys(supported)).toEqual(['algorand'])
        expect(supported.algorand).toEqual({
            chains: [MAINNET_CHAIN_ID],
            methods: [
                'algo_signTxn',
                'algo_signData',
                'algo_getEmptySignatures',
            ],
            events: ['accountsChanged', 'chainChanged'],
            accounts: [`${MAINNET_CHAIN_ID}:${ADDRESS}`],
        })
    })

    it("offers every registered chain's namespace the dApp asked for", async () => {
        dappRequestChainAdapters.register(fixtureAdapter(FIXTURE_V2))

        const supported = await approveProposal(WITH_FIXTURE_CHAIN)

        expect(Object.keys(supported).sort()).toEqual(['algorand', 'fx'])
        // Only the namespace's shape: which addresses a second chain's
        // namespace carries is that chain's to decide once one serves v2.
        expect(supported.fx).toMatchObject({
            chains: [FIXTURE_CHAIN_ID],
            methods: ['fx_sign'],
            events: ['accountsChanged', 'chainChanged'],
        })
    })

    it('offers nothing for a chain that serves no v2', async () => {
        dappRequestChainAdapters.register(fixtureAdapter(undefined))

        const supported = await approveProposal(WITH_FIXTURE_CHAIN)

        expect(Object.keys(supported)).toEqual(['algorand'])
    })
})
