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
import { ChainAdapterNotRegisteredError } from '@perawallet/wallet-core-chain-contract'
import { ConnectionsError, type ConnectionsErrorCode } from '../errors'
import {
    DappRequestFailedError,
    DappRequestRejectedError,
    dappRelayableErrorNames,
    dappRequestChainAdapters,
    dappRequestFailureOf,
    isDappUserRejection,
    type DappRequestChainAdapter,
} from '../dappRequest'

const fakeAdapter: DappRequestChainAdapter = {
    chainId: 'algorand',
    relayableErrorNames: [],
    accountTypeOf: () => 'Fixture',
    parseSigningParams: () => ({ ok: true, payload: [] }),
    resolveReportedNetwork: scope => scope.networkId,
    emptySignaturesFor: () => ({}),
    walletConnect: {
        namespace: 'algorand',
        caip2ChainIdFor: () => null,
        networkForCaip2ChainId: () => null,
        toWireResult: () => null,
    },
    validateTransactionPayload: () => ({ ok: true, group: [] }),
    useEnqueueTransactionSigning: () => async () => null,
}

describe('dappRequestChainAdapters', () => {
    beforeEach(() => {
        dappRequestChainAdapters.reset()
    })

    it('returns the adapter registered for a chain', () => {
        dappRequestChainAdapters.register(fakeAdapter)

        expect(dappRequestChainAdapters.has('algorand')).toBe(true)
        expect(dappRequestChainAdapters.get('algorand')).toBe(fakeAdapter)
    })

    it('names the dapp-request feature when no adapter is registered', () => {
        expect(dappRequestChainAdapters.has('algorand')).toBe(false)
        expect(() => dappRequestChainAdapters.get('algorand')).toThrow(
            ChainAdapterNotRegisteredError,
        )
        expect(() => dappRequestChainAdapters.get('algorand')).toThrow(
            /dapp-request/,
        )
    })

    it('forgets every adapter on reset', () => {
        dappRequestChainAdapters.register(fakeAdapter)

        dappRequestChainAdapters.reset()

        expect(dappRequestChainAdapters.has('algorand')).toBe(false)
    })
})

describe('dappRelayableErrorNames', () => {
    beforeEach(() => {
        dappRequestChainAdapters.reset()
    })

    it("returns the registered adapter's relay list", () => {
        dappRequestChainAdapters.register({
            ...fakeAdapter,
            relayableErrorNames: ['Arc0001Error'],
        })

        expect(dappRelayableErrorNames('algorand')).toEqual(['Arc0001Error'])
    })

    it('returns none for a chain with no registered adapter', () => {
        expect(dappRelayableErrorNames('algorand')).toEqual([])
    })
})

describe('dappRequestFailureOf', () => {
    it.each([
        ['invalid-payload', 'invalid-params'],
        ['unauthorized-account', 'unauthorized-account'],
        ['unsupported-operation', 'unsupported-method'],
    ] as const)('reads a %s ConnectionsError as %s', (code, failure) => {
        expect(dappRequestFailureOf(new ConnectionsError(code, 'm'))).toBe(
            failure,
        )
    })

    it.each([
        'no-handler',
        'unsupported-chain',
        'already-answered',
    ] as ConnectionsErrorCode[])(
        'reads no failure from a %s ConnectionsError, which no dApp caused',
        code => {
            expect(
                dappRequestFailureOf(new ConnectionsError(code, 'm')),
            ).toBeUndefined()
        },
    )

    it('reads a user rejection', () => {
        const error = new DappRequestRejectedError()

        expect(dappRequestFailureOf(error)).toBe('user-rejected')
        expect(error.message).toBe('User rejected')
        expect(error.name).toBe('DappRequestRejectedError')
    })

    it('reads a wallet-side failure, and nothing when it names no kind', () => {
        expect(
            dappRequestFailureOf(
                new DappRequestFailedError('Request failed', 'invalid-params'),
            ),
        ).toBe('invalid-params')
        expect(
            dappRequestFailureOf(new DappRequestFailedError('Request failed')),
        ).toBeUndefined()
    })

    it('reads nothing from a plain error or a forged failure', () => {
        expect(dappRequestFailureOf(new Error('boom'))).toBeUndefined()
        expect(
            dappRequestFailureOf(
                Object.assign(new Error('boom'), { failure: 'x' }),
            ),
        ).toBeUndefined()
    })
})

describe('isDappUserRejection', () => {
    it('treats a DappRequestRejectedError and a UserCancelledError as the user declining, and nothing else', () => {
        const cancelled = new Error('cancelled')
        cancelled.name = 'UserCancelledError'

        expect(isDappUserRejection(new DappRequestRejectedError())).toBe(true)
        expect(isDappUserRejection(cancelled)).toBe(true)
        expect(
            isDappUserRejection(
                new DappRequestFailedError('x', 'invalid-params'),
            ),
        ).toBe(false)
        expect(isDappUserRejection(new Error('User rejected'))).toBe(false)
    })
})
