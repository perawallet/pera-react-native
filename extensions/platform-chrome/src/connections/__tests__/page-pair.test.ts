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

import { describe, it, expect } from 'vitest'
import { WC_PAGE_PAIR_SCOPE, isWcPagePairMessage } from '../page-pair'

describe('isWcPagePairMessage', () => {
    it('accepts a well-formed pair request', () => {
        expect(
            isWcPagePairMessage({
                scope: WC_PAGE_PAIR_SCOPE,
                uri: 'wc:topic@1?bridge=b&key=00',
                hasUserActivation: true,
            }),
        ).toBe(true)
    })

    it('accepts hasUserActivation false — shape only, the route enforces the policy', () => {
        expect(
            isWcPagePairMessage({
                scope: WC_PAGE_PAIR_SCOPE,
                uri: 'wc:topic@1?bridge=b&key=00',
                hasUserActivation: false,
            }),
        ).toBe(true)
    })

    it('rejects a missing hasUserActivation', () => {
        expect(
            isWcPagePairMessage({
                scope: WC_PAGE_PAIR_SCOPE,
                uri: 'wc:topic@1?bridge=b&key=00',
            }),
        ).toBe(false)
    })

    it('rejects a non-boolean hasUserActivation', () => {
        expect(
            isWcPagePairMessage({
                scope: WC_PAGE_PAIR_SCOPE,
                uri: 'wc:topic@1?bridge=b&key=00',
                hasUserActivation: 'true',
            }),
        ).toBe(false)
    })

    it('rejects another scope', () => {
        expect(
            isWcPagePairMessage({
                scope: 'pera-wc-control',
                uri: 'wc:topic@1?bridge=b&key=00',
            }),
        ).toBe(false)
    })

    it('rejects a missing uri', () => {
        expect(isWcPagePairMessage({ scope: WC_PAGE_PAIR_SCOPE })).toBe(false)
    })

    it('rejects a non-string uri', () => {
        expect(
            isWcPagePairMessage({ scope: WC_PAGE_PAIR_SCOPE, uri: 42 }),
        ).toBe(false)
    })

    it('rejects a non-wc uri scheme', () => {
        expect(
            isWcPagePairMessage({
                scope: WC_PAGE_PAIR_SCOPE,
                uri: 'https://evil.example',
            }),
        ).toBe(false)
    })

    it('rejects an over-long uri', () => {
        expect(
            isWcPagePairMessage({
                scope: WC_PAGE_PAIR_SCOPE,
                uri: `wc:${'a'.repeat(5000)}`,
            }),
        ).toBe(false)
    })

    it('rejects a non-object', () => {
        expect(isWcPagePairMessage(null)).toBe(false)
        expect(isWcPagePairMessage('pair')).toBe(false)
    })

    it('rejects a page-supplied origin field by ignoring it entirely', () => {
        const withOrigin = {
            scope: WC_PAGE_PAIR_SCOPE,
            uri: 'wc:topic@1?bridge=b&key=00',
            hasUserActivation: true,
            requesterOrigin: 'https://trusted.example',
        }
        expect(isWcPagePairMessage(withOrigin)).toBe(true)
        // The guard narrows to the declared shape only; consumers must read
        // the origin from sender.origin, never from the message.
    })
})
