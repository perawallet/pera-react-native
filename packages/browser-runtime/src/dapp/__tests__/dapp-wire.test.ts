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
    DAPP_HOST_REQUEST_SCOPE,
    DAPP_HOST_RESPONSE_SCOPE,
    DAPP_PAGE_REQUEST_SCOPE,
    DAPP_PAGE_RESPONSE_SCOPE,
    isDappHostRequestMessage,
    isDappHostResponseMessage,
    isDappPageRequestAck,
    isDappPageRequestMessage,
    isDappPageResponseMessage,
} from '../dapp-wire'

const request = { jsonrpc: '2.0', id: 'r1', method: 'connect' }
const response = { jsonrpc: '2.0', id: 'r1', result: null }
const notification = { jsonrpc: '2.0', method: 'disconnect', params: {} }

describe('dapp wire guards', () => {
    it('page request: scope + JSON-RPC request + boolean activation', () => {
        expect(
            isDappPageRequestMessage({
                scope: DAPP_PAGE_REQUEST_SCOPE,
                request,
                hasUserActivation: true,
            }),
        ).toBe(true)
        expect(
            isDappPageRequestMessage({
                scope: DAPP_PAGE_REQUEST_SCOPE,
                request,
                hasUserActivation: 'yes',
            }),
        ).toBe(false)
        expect(
            isDappPageRequestMessage({
                scope: DAPP_PAGE_REQUEST_SCOPE,
                request: notification,
                hasUserActivation: true,
            }),
        ).toBe(false)
        expect(
            isDappPageRequestMessage({
                scope: 'other',
                request,
                hasUserActivation: true,
            }),
        ).toBe(false)
    })
    it('page request ack: ok, or a refusal carrying a JSON-RPC response', () => {
        expect(isDappPageRequestAck({ ok: true })).toBe(true)
        expect(isDappPageRequestAck({ ok: false, response })).toBe(true)
        expect(isDappPageRequestAck({ ok: false })).toBe(false)
        expect(isDappPageRequestAck(undefined)).toBe(false)
    })
    it('page response: origin + response or notification payload', () => {
        expect(
            isDappPageResponseMessage({
                scope: DAPP_PAGE_RESPONSE_SCOPE,
                origin: 'https://a.example',
                payload: response,
            }),
        ).toBe(true)
        expect(
            isDappPageResponseMessage({
                scope: DAPP_PAGE_RESPONSE_SCOPE,
                origin: 'https://a.example',
                payload: notification,
            }),
        ).toBe(true)
        expect(
            isDappPageResponseMessage({
                scope: DAPP_PAGE_RESPONSE_SCOPE,
                origin: 'https://a.example',
                payload: request,
            }),
        ).toBe(false)
        expect(
            isDappPageResponseMessage({
                scope: DAPP_PAGE_RESPONSE_SCOPE,
                payload: response,
            }),
        ).toBe(false)
    })
    it('host request: verified origin, activation, return address, request; favicon optional', () => {
        const base = {
            scope: DAPP_HOST_REQUEST_SCOPE,
            origin: 'https://a.example',
            hasUserActivation: true,
            returnTo: { tabId: 3 },
            request,
        }
        expect(isDappHostRequestMessage(base)).toBe(true)
        expect(
            isDappHostRequestMessage({
                ...base,
                faviconUrl: 'https://a.example/f.ico',
            }),
        ).toBe(true)
        expect(isDappHostRequestMessage({ ...base, returnTo: {} })).toBe(false)
        expect(isDappHostRequestMessage({ ...base, origin: 7 })).toBe(false)
    })
    it('host response: origin + payload, return address optional', () => {
        expect(
            isDappHostResponseMessage({
                scope: DAPP_HOST_RESPONSE_SCOPE,
                origin: 'https://a.example',
                payload: response,
                returnTo: { tabId: 1 },
            }),
        ).toBe(true)
        expect(
            isDappHostResponseMessage({
                scope: DAPP_HOST_RESPONSE_SCOPE,
                origin: 'https://a.example',
                payload: notification,
            }),
        ).toBe(true)
        expect(
            isDappHostResponseMessage({
                scope: DAPP_HOST_RESPONSE_SCOPE,
                origin: 'https://a.example',
                payload: notification,
                returnTo: { tabId: 'x' },
            }),
        ).toBe(false)
    })
})
