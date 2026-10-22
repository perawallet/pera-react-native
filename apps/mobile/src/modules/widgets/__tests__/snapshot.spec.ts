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
    priceFeed: {
        backendUrl: 'https://mainnet.api.example',
        apiKey: 'key',
        currencyCode: 'EUR',
    },
    portfolioFeed: {
        accounts: [{ address: 'ADDR', name: 'Main' }],
        period: 'one-week',
    },
    assetOptions: [{ assetId: '31566704', name: 'USDC', unitName: 'USDC' }],
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
    backup: {
        cloud: { state: 'backedUp', title: 'Backed up', detail: null },
        passphrase: { state: 'backedUp', title: 'All backed up', detail: null },
    },
    receiveTargets: [
        {
            address: 'ADDR',
            name: 'Main',
            paymentUri: 'algorand://ADDR',
            chain: 'algorand:mainnet',
        },
    ],
    inboxFeed: {
        deviceId: 'device-1',
        addresses: ['ADDR'],
        accountNames: [{ address: 'ADDR', name: 'Main' }],
        notifications: null,
    },
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

    it('returns undefined while backup status is not ready', () => {
        const snapshot = buildWidgetSnapshot({
            ...baseInput(),
            backup: undefined,
        })

        expect(snapshot).toBeUndefined()
    })

    // Backup status reveals no holdings, and its nudge matters most then.
    it('keeps backup status in privacy mode', () => {
        const input = baseInput()

        const snapshot = buildWidgetSnapshot({ ...input, isPrivacyMode: true })

        expect(snapshot?.backup).toEqual(input.backup)
    })

    it('passes the receive targets through for the Receive QR widget', () => {
        const input = baseInput()

        expect(buildWidgetSnapshot(input)?.receiveTargets).toEqual(
            input.receiveTargets,
        )
    })

    it('writes no addresses for the Receive QR widget in privacy mode', () => {
        const snapshot = buildWidgetSnapshot({
            ...baseInput(),
            isPrivacyMode: true,
        })

        expect(snapshot?.receiveTargets).toBeNull()
    })

    it('passes the inbox feed through so the inbox widgets can fetch', () => {
        const input = baseInput()

        expect(buildWidgetSnapshot(input)?.inboxFeed).toEqual(input.inboxFeed)
    })

    it('shares no inbox feed in privacy mode even if one is passed', () => {
        const snapshot = buildWidgetSnapshot({
            ...baseInput(),
            isPrivacyMode: true,
        })

        expect(snapshot?.inboxFeed).toBeNull()
    })

    it('writes no backup status when there are no accounts', () => {
        const snapshot = buildWidgetSnapshot({
            ...baseInput(),
            hasAccounts: false,
            backup: undefined,
        })

        expect(snapshot?.backup).toBeNull()
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

    it('writes null for an unknown price, never zero', () => {
        const input = baseInput()
        const snapshot = buildWidgetSnapshot({
            ...input,
            algoPrice: { ...input.algoPrice!, value: null },
        })

        expect(snapshot?.algoPrice).toBeNull()
    })

    it('writes no portfolio when the ALGO total itself is unknown', () => {
        const input = baseInput()
        const snapshot = buildWidgetSnapshot({
            ...input,
            portfolio: { ...input.portfolio!, algoValue: null },
        })

        expect(snapshot?.portfolio).toBeNull()
    })

    it('keeps the ALGO portfolio when its fiat value is unknown', () => {
        const input = baseInput()
        const snapshot = buildWidgetSnapshot({
            ...input,
            portfolio: { ...input.portfolio!, value: null },
        })

        expect(snapshot?.portfolio).toEqual({
            state: 'visible',
            formatted: null,
            algoFormatted: 'ALGO6500.12 ALGO',
            asOf: 2000,
        })
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

    it('passes the price feed through so the widget can refresh the price itself', () => {
        const snapshot = buildWidgetSnapshot(baseInput())

        expect(snapshot?.priceFeed).toEqual({
            backendUrl: 'https://mainnet.api.example',
            apiKey: 'key',
            currencyCode: 'EUR',
        })
    })

    it('passes the portfolio feed through so the widget can refresh balances', () => {
        const snapshot = buildWidgetSnapshot(baseInput())

        expect(snapshot?.portfolioFeed).toEqual({
            accounts: [{ address: 'ADDR', name: 'Main' }],
            period: 'one-week',
        })
    })

    // Defence in depth: addresses never reach the widget while privacy mode is on.
    it('drops the portfolio feed in privacy mode even if one is passed', () => {
        const snapshot = buildWidgetSnapshot({
            ...baseInput(),
            isPrivacyMode: true,
        })

        expect(snapshot?.portfolioFeed).toBeNull()
    })

    it('passes the verified asset options through for the price widget', () => {
        const snapshot = buildWidgetSnapshot(baseInput())

        expect(snapshot?.assetOptions).toEqual([
            { assetId: '31566704', name: 'USDC', unitName: 'USDC' },
        ])
    })

    it('shares no asset options in privacy mode, where they reveal holdings', () => {
        const snapshot = buildWidgetSnapshot({
            ...baseInput(),
            isPrivacyMode: true,
        })

        expect(snapshot?.assetOptions).toBeNull()
    })

    it('writes an empty asset list while it is still loading rather than waiting', () => {
        const snapshot = buildWidgetSnapshot({
            ...baseInput(),
            assetOptions: undefined,
        })

        expect(snapshot?.assetOptions).toEqual([])
    })

    it('keeps a null price feed on networks without a Pera backend', () => {
        const snapshot = buildWidgetSnapshot({
            ...baseInput(),
            priceFeed: null,
        })

        expect(snapshot?.priceFeed).toBeNull()
        expect(widgetSnapshotSchema.safeParse(snapshot).success).toBe(true)
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
