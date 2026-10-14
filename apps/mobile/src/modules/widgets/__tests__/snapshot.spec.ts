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
import { Decimal } from 'decimal.js'
import { formatCurrency } from '@perawallet/wallet-core-shared'
import {
    buildWidgetSnapshot,
    MAX_WIDGET_NFTS,
    selectWidgetNftImages,
    widgetSnapshotSchema,
    type BuildWidgetSnapshotInput,
    type WidgetNftCandidate,
} from '../snapshot'

const nft = (
    assetId: string,
    imageUrl = `https://x/${assetId}.png`,
): WidgetNftCandidate => ({
    assetId,
    title: `NFT ${assetId}`,
    collectionName: 'Collection',
    imageUrl,
})

const baseInput = (): BuildWidgetSnapshotInput => ({
    locale: 'en',
    theme: 'system',
    network: { isMainnet: true, label: 'MainNet' },
    strings: { updated: 'Updated' },
    isPrivacyMode: false,
    hasAccounts: true,
    algoPrice: {
        value: new Decimal('0.1923'),
        currencyCode: 'USD',
        asOf: 1000,
    },
    portfolio: {
        value: new Decimal('1234.56'),
        currencyCode: 'USD',
        algoValue: new Decimal('6500.12'),
        asOf: 2000,
    },
    nfts: [nft('286018494')],
    cachedImageKeys: ['286018494'],
})

describe('buildWidgetSnapshot', () => {
    it('returns undefined while the price is not ready', () => {
        const snapshot = buildWidgetSnapshot({
            ...baseInput(),
            algoPrice: undefined,
        })

        expect(snapshot).toBeUndefined()
    })

    it('returns undefined while the portfolio is not ready', () => {
        const snapshot = buildWidgetSnapshot({
            ...baseInput(),
            portfolio: undefined,
        })

        expect(snapshot).toBeUndefined()
    })

    it('returns undefined while NFTs are not ready and privacy is off', () => {
        const snapshot = buildWidgetSnapshot({
            ...baseInput(),
            nfts: undefined,
        })

        expect(snapshot).toBeUndefined()
    })

    it('hides portfolio and NFTs in privacy mode even while NFT inputs are pending', () => {
        const snapshot = buildWidgetSnapshot({
            ...baseInput(),
            isPrivacyMode: true,
            nfts: undefined,
        })

        expect(snapshot?.portfolio).toEqual({ state: 'hidden' })
        expect(snapshot?.nfts).toEqual({ state: 'hidden' })
    })

    it('keeps the price visible in privacy mode', () => {
        const snapshot = buildWidgetSnapshot({
            ...baseInput(),
            isPrivacyMode: true,
        })

        expect(snapshot?.algoPrice).toEqual({
            formatted: 'USD0.1923',
            asOf: 1000,
        })
    })

    it('writes null portfolio and NFTs when there are no accounts', () => {
        const snapshot = buildWidgetSnapshot({
            ...baseInput(),
            hasAccounts: false,
            portfolio: undefined,
            nfts: undefined,
        })

        expect(snapshot?.portfolio).toBeNull()
        expect(snapshot?.nfts).toBeNull()
    })

    it('writes null for a price or portfolio whose value is unknown, never zero', () => {
        const input = baseInput()
        const snapshot = buildWidgetSnapshot({
            ...input,
            algoPrice: { ...input.algoPrice!, value: null },
            portfolio: { ...input.portfolio!, value: null },
        })

        expect(snapshot?.algoPrice).toBeNull()
        expect(snapshot?.portfolio).toBeNull()
    })

    // formatCurrency is mocked app-wide as `${currency}${value}`; its own
    // tests own the real output, these pin what the builder passes it.
    it('formats the portfolio in its currency and names the ALGO unit', () => {
        const snapshot = buildWidgetSnapshot(baseInput())

        expect(snapshot?.portfolio).toEqual({
            state: 'visible',
            formatted: 'USD1234.56',
            algoFormatted: 'ALGO6500.12 ALGO',
            asOf: 2000,
        })
    })

    it('formats with the snapshot locale', () => {
        buildWidgetSnapshot({ ...baseInput(), locale: 'de' })

        expect(formatCurrency).toHaveBeenCalledWith(
            new Decimal('1234.56'),
            2,
            'USD',
            'de',
        )
    })

    it('only includes NFTs whose image key is cached', () => {
        const snapshot = buildWidgetSnapshot({
            ...baseInput(),
            nfts: [nft('1'), nft('2')],
            cachedImageKeys: ['2'],
        })

        expect(snapshot?.nfts).toEqual({
            state: 'visible',
            items: [
                {
                    assetId: '2',
                    title: 'NFT 2',
                    collectionName: 'Collection',
                    imageKey: '2',
                },
            ],
        })
    })

    it('propagates locale, theme, network and strings unchanged', () => {
        const snapshot = buildWidgetSnapshot({
            ...baseInput(),
            locale: 'pt-BR',
            theme: 'dark',
            network: { isMainnet: false, label: 'TestNet' },
            strings: { updated: 'Atualizado' },
        })

        expect(snapshot).toMatchObject({
            locale: 'pt-BR',
            theme: 'dark',
            network: { isMainnet: false, label: 'TestNet' },
            strings: { updated: 'Atualizado' },
        })
    })

    it('produces output the schema accepts', () => {
        const snapshot = buildWidgetSnapshot(baseInput())

        expect(widgetSnapshotSchema.safeParse(snapshot).success).toBe(true)
    })
})

describe('selectWidgetNftImages', () => {
    it('keeps only https URLs', () => {
        const requests = selectWidgetNftImages([
            nft('1', 'http://x/a.png'),
            nft('2', 'not a url'),
            nft('3', 'ipfs://abc'),
            nft('4', 'https://x/d.png'),
        ])

        expect(requests).toEqual([{ key: '4', url: 'https://x/d.png' }])
    })

    it('drops asset ids that are not plain digits', () => {
        const requests = selectWidgetNftImages([nft('../etc'), nft('5')])

        expect(requests.map(r => r.key)).toEqual(['5'])
    })

    it('caps the list at MAX_WIDGET_NFTS', () => {
        const candidates = Array.from({ length: MAX_WIDGET_NFTS + 5 }, (_, i) =>
            nft(String(i + 1)),
        )

        expect(selectWidgetNftImages(candidates)).toHaveLength(MAX_WIDGET_NFTS)
    })
})
