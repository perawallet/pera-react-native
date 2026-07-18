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
import { getTrustedIframeOrigins } from '../trusted-iframe-origins.web'

const { getNetworkConfig } = vi.hoisted(() => ({
    getNetworkConfig: vi.fn(),
}))

const MAINNET_BIDALI = 'https://commerce.bidali.com/dapp'
const TESTNET_BIDALI = 'https://commerce.staging.bidali.com/dapp'

vi.mock('@perawallet/wallet-core-config', () => ({
    config: {
        discoverBaseUrl: 'https://discover-mobile-staging.perawallet.app/',
    },
    getNetworkConfig,
    Networks: { mainnet: 'mainnet', testnet: 'testnet' },
}))

beforeEach(() => {
    getNetworkConfig.mockImplementation((network: string) => ({
        bidaliBaseUrl: network === 'mainnet' ? MAINNET_BIDALI : TESTNET_BIDALI,
    }))
})

describe('getTrustedIframeOrigins', () => {
    it('returns the Discover origin only for a Discover URL', () => {
        expect(
            getTrustedIframeOrigins(
                'https://discover-mobile-staging.perawallet.app/some/dapp',
            ),
        ).toEqual(['https://discover-mobile-staging.perawallet.app'])
    })

    it('returns the commerce + giftcards twin pair for a mainnet Bidali URL', () => {
        expect(
            getTrustedIframeOrigins('https://commerce.bidali.com/dapp?key=x'),
        ).toEqual([
            'https://commerce.bidali.com',
            'https://giftcards.bidali.com',
        ])
    })

    it('returns the staging commerce + giftcards twin pair for a testnet Bidali URL', () => {
        expect(
            getTrustedIframeOrigins(
                'https://commerce.staging.bidali.com/dapp?key=x',
            ),
        ).toEqual([
            'https://commerce.staging.bidali.com',
            'https://giftcards.staging.bidali.com',
        ])
    })

    it('returns an empty set for a URL unrelated to any known mount', () => {
        expect(getTrustedIframeOrigins('https://example.com')).toEqual([])
    })

    it('falls back to itself when the configured Bidali base is already giftcards-hosted (env override)', () => {
        getNetworkConfig.mockImplementation(() => ({
            bidaliBaseUrl: 'https://giftcards.bidali.com/dapp',
        }))
        expect(
            getTrustedIframeOrigins('https://giftcards.bidali.com/dapp?key=x'),
        ).toEqual(['https://giftcards.bidali.com'])
    })
})
