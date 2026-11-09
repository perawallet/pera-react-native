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
    COIN_ID,
    FIAT_ID,
    NATIVE_ID,
    STABLE_ID,
    coinAsset,
    fiatAsset,
    pairRow,
    stableAsset,
} from '../../../__tests__/routerFixtures'
import type { RampToken } from '../../../models'
import { attachNetworkLogos, transformRampPairRow } from '../transformers'

describe('transformRampPairRow', () => {
    it('maps a token row', () => {
        expect(transformRampPairRow(pairRow(stableAsset()))).toEqual({
            id: STABLE_ID,
            kind: 'token',
            symbol: 'STB',
            name: 'Stable',
            fractionDecimals: 6,
            logo: 'https://logo/stb.png',
            network: { name: '', logo: null },
        })
    })

    it("maps a deposit coin, taking its chain label as the network's name", () => {
        const token = transformRampPairRow(
            pairRow(coinAsset(), { kind: 'deposit' }),
        )

        expect(token).toMatchObject({
            id: COIN_ID,
            kind: 'deposit',
            fractionDecimals: 8,
            network: { name: 'Other Chain' },
        })
    })

    it("derives a fiat's country code from the first two letters of its currency", () => {
        const token = transformRampPairRow(
            pairRow(fiatAsset(), { kind: 'fiat' }),
        )

        expect(token).toMatchObject({
            id: FIAT_ID,
            kind: 'fiat',
            fractionDecimals: 2,
            countryCode: 'EU',
        })
    })

    it('reads the kind off the asset when the row names none', () => {
        expect(
            transformRampPairRow(pairRow(fiatAsset(), { kind: null }))?.kind,
        ).toBe('fiat')
        expect(
            transformRampPairRow(pairRow(coinAsset(), { kind: undefined }))
                ?.kind,
        ).toBe('deposit')
        expect(
            transformRampPairRow(
                pairRow({ asset_id: NATIVE_ID, decimals: 6 }, { kind: null }),
            )?.kind,
        ).toBe('token')
    })

    it('reads either spelling of the asset fields', () => {
        const token = transformRampPairRow(
            pairRow({
                asset_id: STABLE_ID,
                symbol: 'STB',
                decimals: 3,
                logo_url: 'https://logo/x.png',
            }),
        )

        expect(token).toMatchObject({
            symbol: 'STB',
            name: 'STB',
            fractionDecimals: 3,
            logo: 'https://logo/x.png',
        })
    })

    it('drops a non-fiat row that gives no decimals', () => {
        expect(
            transformRampPairRow(pairRow({ asset_id: NATIVE_ID })),
        ).toBeNull()
    })

    it('drops a fiat row that gives no decimals rather than assuming two', () => {
        expect(
            transformRampPairRow(
                pairRow(
                    { asset_id: 'swift:0/iso4217:JPY', unit_name: 'JPY' },
                    { kind: 'fiat' },
                ),
            ),
        ).toBeNull()
    })
})

const token = (id: string, overrides: Partial<RampToken> = {}): RampToken => ({
    id,
    kind: 'deposit',
    symbol: 'C',
    name: 'Coin',
    fractionDecimals: 8,
    logo: null,
    network: { name: 'Chain', logo: null },
    ...overrides,
})

const SOL_ID = 'solana:main/slip44:501'
const USDC_SOL_ID = 'solana:main/token:usdc'
const USDC_BASE_ID = 'eip155:8453/erc20:0xusdc'

describe('attachNetworkLogos', () => {
    it("gives a deposit coin its chain's native coin logo", () => {
        const tokens = attachNetworkLogos([
            token(USDC_SOL_ID, { logo: 'https://logo/usdc.png' }),
            token(SOL_ID, { logo: 'https://logo/sol.png' }),
        ])

        expect(tokens.map(item => item.network.logo)).toEqual([
            'https://logo/sol.png',
            'https://logo/sol.png',
        ])
    })

    it('leaves a coin whose chain has no native coin listed without a logo', () => {
        const [usdcOnBase] = attachNetworkLogos([
            token(USDC_BASE_ID),
            token(SOL_ID, { logo: 'https://logo/sol.png' }),
        ])

        expect(usdcOnBase.network.logo).toBeNull()
    })

    it('leaves fiat alone and keeps a network logo the token already has', () => {
        const fiat = token('swift:0/iso4217:EUR', { kind: 'fiat' })
        const withLogo = token(USDC_SOL_ID, {
            network: { name: 'Solana', logo: 'https://logo/own.png' },
        })

        const [fiatOut, withLogoOut] = attachNetworkLogos([
            fiat,
            withLogo,
            token(SOL_ID, { logo: 'https://logo/sol.png' }),
        ])

        expect(fiatOut).toBe(fiat)
        expect(withLogoOut.network.logo).toBe('https://logo/own.png')
    })

    it('does not mutate its input', () => {
        const usdc = token(USDC_SOL_ID)

        attachNetworkLogos([
            usdc,
            token(SOL_ID, { logo: 'https://logo/sol.png' }),
        ])

        expect(usdc.network.logo).toBeNull()
    })
})
