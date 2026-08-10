/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, it, expect } from 'vitest'
import {
    WC_CONTROL_SCOPE,
    WC_PAIR_OUTCOME_SCOPE,
    WC_REQUEST_SCOPE,
    isWcControlMessage,
    isWcApprovalRequestMessage,
    isWcPairOutcomeMessage,
} from '../protocol'

describe('isWcControlMessage', () => {
    it('accepts a pair command', () => {
        expect(
            isWcControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'pair',
                uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
            }),
        ).toBe(true)
    })

    it('accepts a deliver command carrying a success outcome', () => {
        expect(
            isWcControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'deliver',
                clientId: 'c1',
                wcRequestId: 1,
                outcome: { ok: true, result: [] },
            }),
        ).toBe(true)
    })

    it('rejects a message from another scope', () => {
        expect(
            isWcControlMessage({ scope: 'pera-db-control', kind: 'pair' }),
        ).toBe(false)
    })

    it('rejects an unknown kind', () => {
        expect(
            isWcControlMessage({ scope: WC_CONTROL_SCOPE, kind: 'nope' }),
        ).toBe(false)
    })

    it('rejects a pair command with no uri', () => {
        expect(
            isWcControlMessage({ scope: WC_CONTROL_SCOPE, kind: 'pair' }),
        ).toBe(false)
    })

    it('accepts a pair command carrying a correlationId', () => {
        expect(
            isWcControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'pair',
                uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
                correlationId: 'corr-1',
            }),
        ).toBe(true)
    })

    it('rejects a pair command whose correlationId is not a string', () => {
        expect(
            isWcControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'pair',
                uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
                correlationId: 42,
            }),
        ).toBe(false)
    })

    it('accepts a pair command carrying a requester origin', () => {
        expect(
            isWcControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'pair',
                uri: 'wc:topic@1?bridge=b&key=00',
                correlationId: 'corr-1',
                requesterOrigin: 'https://dapp.example',
            }),
        ).toBe(true)
    })

    it('accepts a pair command with no requester origin', () => {
        expect(
            isWcControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'pair',
                uri: 'wc:topic@1?bridge=b&key=00',
                correlationId: 'corr-1',
            }),
        ).toBe(true)
    })

    it('rejects a pair command whose requester origin is not a string', () => {
        expect(
            isWcControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'pair',
                uri: 'wc:topic@1?bridge=b&key=00',
                correlationId: 'corr-1',
                requesterOrigin: 42,
            }),
        ).toBe(false)
    })

    it('accepts an approve-session command', () => {
        expect(
            isWcControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'approve-session',
                clientId: 'c1',
                approvedAddresses: ['AAAA', 'BBBB'],
                chainId: 416_001,
            }),
        ).toBe(true)
    })

    it('rejects an approve-session command whose addresses are not all strings', () => {
        expect(
            isWcControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'approve-session',
                clientId: 'c1',
                approvedAddresses: ['AAAA', 42],
                chainId: 416_001,
            }),
        ).toBe(false)
    })

    it('rejects an approve-session command with a non-numeric chainId', () => {
        expect(
            isWcControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'approve-session',
                clientId: 'c1',
                approvedAddresses: ['AAAA'],
                chainId: '416001',
            }),
        ).toBe(false)
    })

    it('rejects an approve-session command with no clientId', () => {
        expect(
            isWcControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'approve-session',
                approvedAddresses: ['AAAA'],
                chainId: 416_001,
            }),
        ).toBe(false)
    })

    it('accepts a reject-session command', () => {
        expect(
            isWcControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'reject-session',
                clientId: 'c1',
            }),
        ).toBe(true)
    })

    it('rejects a reject-session command with no clientId', () => {
        expect(
            isWcControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'reject-session',
            }),
        ).toBe(false)
    })

    it('rejects a non-object', () => {
        expect(isWcControlMessage(null)).toBe(false)
        expect(isWcControlMessage('pair')).toBe(false)
    })
})

describe('isWcApprovalRequestMessage', () => {
    it('accepts a wc-connect request', () => {
        expect(
            isWcApprovalRequestMessage({
                scope: WC_REQUEST_SCOPE,
                request: {
                    kind: 'wc-connect',
                    clientId: 'c1',
                    chainId: 416_001,
                    origin: 'https://dapp.example',
                },
            }),
        ).toBe(true)
    })

    it('accepts a wc-sign request', () => {
        expect(
            isWcApprovalRequestMessage({
                scope: WC_REQUEST_SCOPE,
                request: {
                    kind: 'wc-sign',
                    clientId: 'c1',
                    wcRequestId: 9,
                    method: 'algo_signTxn',
                    payload: {},
                    origin: 'https://dapp.example',
                },
            }),
        ).toBe(true)
    })

    it('rejects a message from another scope', () => {
        expect(
            isWcApprovalRequestMessage({
                scope: WC_CONTROL_SCOPE,
                request: { kind: 'wc-connect' },
            }),
        ).toBe(false)
    })

    it('rejects an unknown request kind', () => {
        expect(
            isWcApprovalRequestMessage({
                scope: WC_REQUEST_SCOPE,
                request: { kind: 'nope' },
            }),
        ).toBe(false)
    })

    it('rejects a non-object', () => {
        expect(isWcApprovalRequestMessage(null)).toBe(false)
        expect(isWcApprovalRequestMessage('wc-connect')).toBe(false)
    })
})

describe('isWcPairOutcomeMessage', () => {
    it('accepts a session outcome', () => {
        expect(
            isWcPairOutcomeMessage({
                scope: WC_PAIR_OUTCOME_SCOPE,
                correlationId: 'corr-1',
                outcome: { type: 'session' },
            }),
        ).toBe(true)
    })

    it('accepts an error outcome with a reason', () => {
        expect(
            isWcPairOutcomeMessage({
                scope: WC_PAIR_OUTCOME_SCOPE,
                correlationId: 'corr-1',
                outcome: { type: 'error', reason: 'network-mismatch' },
            }),
        ).toBe(true)
    })

    it('accepts a timeout outcome', () => {
        expect(
            isWcPairOutcomeMessage({
                scope: WC_PAIR_OUTCOME_SCOPE,
                correlationId: 'corr-1',
                outcome: { type: 'timeout' },
            }),
        ).toBe(true)
    })

    it('rejects an error outcome with no reason', () => {
        expect(
            isWcPairOutcomeMessage({
                scope: WC_PAIR_OUTCOME_SCOPE,
                correlationId: 'corr-1',
                outcome: { type: 'error' },
            }),
        ).toBe(false)
    })

    it('rejects an outcome with an unknown type', () => {
        expect(
            isWcPairOutcomeMessage({
                scope: WC_PAIR_OUTCOME_SCOPE,
                correlationId: 'corr-1',
                outcome: { type: 'nope' },
            }),
        ).toBe(false)
    })

    it('rejects a message with no correlationId', () => {
        expect(
            isWcPairOutcomeMessage({
                scope: WC_PAIR_OUTCOME_SCOPE,
                outcome: { type: 'session' },
            }),
        ).toBe(false)
    })

    it('rejects a message from another scope', () => {
        expect(
            isWcPairOutcomeMessage({
                scope: WC_CONTROL_SCOPE,
                correlationId: 'corr-1',
                outcome: { type: 'session' },
            }),
        ).toBe(false)
    })

    it('rejects a non-object', () => {
        expect(isWcPairOutcomeMessage(null)).toBe(false)
        expect(isWcPairOutcomeMessage('pair-outcome')).toBe(false)
    })
})
