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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Networks } from '@perawallet/wallet-core-shared'
import {
    dappRequestChainAdapters,
    type DappRequestChainAdapter,
} from '@perawallet/wallet-core-connections/dappRequest'
import { AlgorandWalletConnectChainId } from '../../models'
import { gateSignDataRequest, gateSignTxnRequest } from '../inboundRequestGate'

// The gate's own job is the envelope, the session-chain check and the
// array-vs-object discriminator; the payload itself (transaction-list shape,
// ARC-60 schema) is the chain adapter's, covered by that chain's own tests
// (e.g. chain-algorand's `walletConnect.spec.ts`). A fake adapter here lets
// this file assert on the DELEGATION alone, decoupled from any one chain's
// payload rules.
const screenRequest = vi.fn()

const fakeAdapter: DappRequestChainAdapter = {
    chainId: 'algorand',
    relayableErrorNames: [],
    parseSigningParams: () => ({ ok: true, payload: [] }),
    resolveReportedNetwork: scope => scope.networkId,
    walletConnect: {
        namespace: 'algorand',
        caip2ChainIdFor: () => null,
        networkForCaip2ChainId: () => null,
        toWireResult: () => null,
        v1: {
            isChainIdAcceptable: (chainId, networkId) =>
                chainId === AlgorandWalletConnectChainId.mainnet &&
                networkId === 'mainnet',
            networksFor: () => ['mainnet'],
            screenRequest,
        },
    },
    validateTransactionPayload: () => ({ ok: true, group: [] }),
    useEnqueueTransactionSigning: () => async () => null,
}

beforeEach(() => {
    dappRequestChainAdapters.reset()
    dappRequestChainAdapters.register(fakeAdapter)
    screenRequest.mockReset()
    screenRequest.mockReturnValue({ ok: true })
})

const KNOWN = ['AAAA', 'BBBB']

const signTxnPayload = (params: unknown) => ({ id: 1, params })

const baseInput = {
    network: Networks.mainnet,
    sessionChainId: AlgorandWalletConnectChainId.mainnet as number | undefined,
    knownAddresses: KNOWN,
}

describe('gateSignTxnRequest', () => {
    it('rejects a payload with no numeric id', () => {
        const result = gateSignTxnRequest({
            ...baseInput,
            payload: { params: [[{ txn: 'dHhu' }]] },
        })
        expect(result.ok).toBe(false)
        expect(screenRequest).not.toHaveBeenCalled()
    })

    it('rejects a payload whose params is not an array', () => {
        const result = gateSignTxnRequest({
            ...baseInput,
            payload: signTxnPayload('nope'),
        })
        expect(result.ok).toBe(false)
        expect(screenRequest).not.toHaveBeenCalled()
    })

    it('rejects a chain id for the other network', () => {
        const result = gateSignTxnRequest({
            ...baseInput,
            sessionChainId: AlgorandWalletConnectChainId.testnet,
            payload: signTxnPayload([[{ txn: 'dHhu' }]]),
        })
        expect(result).toMatchObject({
            ok: false,
            reason: 'chain id not acceptable on the active network',
            code: 'invalid-network',
        })
        expect(screenRequest).not.toHaveBeenCalled()
    })

    it('rejects an unknown session with a session-not-found reason, not the wrong-network one', () => {
        // A dapp resuming a session this wallet has no record of (e.g. wiped
        // extension storage) must not be told it's on the wrong network.
        const result = gateSignTxnRequest({
            ...baseInput,
            sessionChainId: undefined,
            payload: signTxnPayload([[{ txn: 'dHhu' }]]),
        })
        expect(result).toEqual({
            ok: false,
            reason: 'session not found — please disconnect and reconnect the dapp',
            code: 'session-not-found',
        })
        expect(screenRequest).not.toHaveBeenCalled()
    })

    it('extracts the positional group and delegates it with the known addresses', () => {
        const group = [{ txn: 'dHhu', signers: ['AAAA'] }]
        const result = gateSignTxnRequest({
            ...baseInput,
            payload: signTxnPayload([group]),
        })

        expect(screenRequest).toHaveBeenCalledWith(
            'sign-transactions',
            group,
            KNOWN,
        )
        expect(result).toEqual({ ok: true })
    })

    it('turns an adapter refusal into a gate rejection with its own reason', () => {
        screenRequest.mockReturnValue({
            ok: false,
            reason: 'too many transactions in one request',
        })
        const result = gateSignTxnRequest({
            ...baseInput,
            payload: signTxnPayload([[{ txn: 'dHhu' }]]),
        })
        expect(result).toEqual({
            ok: false,
            reason: 'too many transactions in one request',
            code: 'invalid-request',
        })
    })
})

describe('gateSignDataRequest', () => {
    // algo_signData's wire envelope is `{ id, params: <arc60 object> }` — a
    // single object, unlike algo_signTxn's `[[...]]` array-of-arrays.

    it('rejects a payload with no numeric id', () => {
        const result = gateSignDataRequest({
            payload: { params: {} },
            network: Networks.mainnet,
            sessionChainId: AlgorandWalletConnectChainId.mainnet,
        })
        expect(result.ok).toBe(false)
        expect(screenRequest).not.toHaveBeenCalled()
    })

    it('rejects when params is an array (the algo_signTxn envelope shape arriving on the wrong method)', () => {
        const result = gateSignDataRequest({
            payload: { id: 1, params: [{}] },
            network: Networks.mainnet,
            sessionChainId: AlgorandWalletConnectChainId.mainnet,
        })
        expect(result.ok).toBe(false)
        expect(screenRequest).not.toHaveBeenCalled()
    })

    it('rejects a chain id for the other network', () => {
        const result = gateSignDataRequest({
            payload: { id: 1, params: {} },
            network: Networks.mainnet,
            sessionChainId: AlgorandWalletConnectChainId.testnet,
        })
        expect(result).toMatchObject({
            ok: false,
            reason: 'chain id not acceptable on the active network',
            code: 'invalid-network',
        })
        expect(screenRequest).not.toHaveBeenCalled()
    })

    it('rejects an unknown session with a session-not-found reason, not the wrong-network one', () => {
        const result = gateSignDataRequest({
            payload: { id: 1, params: {} },
            network: Networks.mainnet,
            sessionChainId: undefined,
        })
        expect(result).toEqual({
            ok: false,
            reason: 'session not found — please disconnect and reconnect the dapp',
            code: 'session-not-found',
        })
        expect(screenRequest).not.toHaveBeenCalled()
    })

    it('delegates the params object to the chain adapter with no known addresses', () => {
        const payload = { data: 'ZGF0YQ==' }
        const result = gateSignDataRequest({
            payload: { id: 1, params: payload },
            network: Networks.mainnet,
            sessionChainId: AlgorandWalletConnectChainId.mainnet,
        })

        expect(screenRequest).toHaveBeenCalledWith('sign-data', payload, [])
        expect(result).toEqual({ ok: true })
    })

    it('turns an adapter refusal into a gate rejection with its own reason', () => {
        screenRequest.mockReturnValue({
            ok: false,
            reason: 'Invalid ARC-60 sign request payload — request exceeds the maximum allowed size',
        })
        const result = gateSignDataRequest({
            payload: { id: 1, params: {} },
            network: Networks.mainnet,
            sessionChainId: AlgorandWalletConnectChainId.mainnet,
        })
        expect(result).toEqual({
            ok: false,
            reason: 'Invalid ARC-60 sign request payload — request exceeds the maximum allowed size',
            code: 'invalid-request',
        })
    })
})
