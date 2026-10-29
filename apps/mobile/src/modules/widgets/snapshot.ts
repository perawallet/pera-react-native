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

import { z } from 'zod'
import type { Decimal } from 'decimal.js'
import {
    formatCurrency,
    HISTORY_PERIODS,
    httpsUrlSchema,
    isAlgoAssetName,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import type { WidgetImageRequest } from '@perawallet/wallet-extension-platform'

// Mirrored by WidgetSnapshot.swift. Bump only for a breaking shape change: every
// field after `version` is optional on the Swift side, so additions are safe.
export const WIDGET_SNAPSHOT_VERSION = 1
export const MAX_WIDGET_NFTS = 10

const PRICE_PRECISION = 4
const FIAT_PRECISION = 2
const ASSET_ID_PATTERN = /^\d+$/

const hiddenSchema = z.object({ state: z.literal('hidden') })

// Ready-to-show lines: the app owns the wording, plurals and date format, so
// the widget only lays them out.
const backupLineSchema = z.object({
    title: z.string(),
    detail: z.string().nullable(),
})

export const widgetBackupSchema = z.object({
    // Null where cloud backup isn't offered (remote flag or chain capability off).
    cloud: backupLineSchema
        .extend({
            state: z.enum(['notSetUp', 'partial', 'failed', 'backedUp']),
        })
        .nullable(),
    passphrase: backupLineSchema.extend({
        state: z.enum(['needed', 'backedUp']),
    }),
})

export const widgetSnapshotSchema = z.object({
    version: z.literal(WIDGET_SNAPSHOT_VERSION),
    locale: z.string(),
    theme: z.enum(['light', 'dark', 'system']),
    network: z.object({ isMainnet: z.boolean(), label: z.string() }),
    strings: z.record(z.string(), z.string()),
    // Lets the widget refresh the ALGO price between app launches. The key is
    // the same one the app ships with; null where the network has no Pera backend.
    priceFeed: z
        .object({
            backendUrl: z.string(),
            apiKey: z.string(),
            currencyCode: z.string(),
        })
        .nullable(),
    // Lets the widget refresh balances and the chart between app launches. The
    // addresses stay in the App Group and are never rendered; the names label the
    // widget's account picker. Null in privacy mode.
    portfolioFeed: z
        .object({
            accounts: z.array(
                z.object({ address: z.string(), name: z.string() }),
            ),
            period: z.enum(HISTORY_PERIODS),
        })
        .nullable(),
    // Verified fungible assets the user holds, for the price widget's asset
    // option. Null in privacy mode, where it would reveal holdings.
    assetOptions: z
        .array(
            z.object({
                assetId: z.string(),
                name: z.string(),
                unitName: z.string(),
            }),
        )
        .nullable(),
    algoPrice: z.object({ formatted: z.string(), asOf: z.number() }).nullable(),
    portfolio: z
        .discriminatedUnion('state', [
            z.object({
                state: z.literal('visible'),
                /** Preferred currency; null when no fiat rate or price is known. */
                formatted: z.string().nullable(),
                algoFormatted: z.string(),
                asOf: z.number(),
            }),
            hiddenSchema,
        ])
        .nullable(),
    nfts: z
        .discriminatedUnion('state', [
            z.object({
                state: z.literal('visible'),
                items: z
                    .array(
                        z.object({
                            assetId: z.string(),
                            title: z.string(),
                            collectionName: z.string().optional(),
                            imageKey: z.string(),
                        }),
                    )
                    .max(MAX_WIDGET_NFTS),
            }),
            hiddenSchema,
        ])
        .nullable(),
    // Status only, so it shows in privacy mode too. Null without accounts.
    backup: widgetBackupSchema.nullable(),
    // Lets the inbox widgets fetch pending requests and notifications
    // themselves. Device ids and addresses stay in the App Group and are never
    // rendered; `accountNames` labels the rows. Null in privacy mode.
    inboxFeed: z
        .object({
            /** The device id the inbox is keyed by on the widgets' network. */
            deviceId: z.string(),
            /** The accounts the inbox is asked about, as the app's inbox asks. */
            addresses: z.array(z.string()),
            accountNames: z.array(
                z.object({ address: z.string(), name: z.string() }),
            ),
            /** Null where the deployment has no notifications backend. */
            notifications: z
                .object({ backendUrl: z.string(), deviceId: z.string() })
                .nullable(),
        })
        .nullable(),
    // The one place a widget renders an address: the Receive QR widget, which
    // iOS blanks while the phone is locked. Null in privacy mode.
    receiveTargets: z
        .array(
            z.object({
                address: z.string(),
                name: z.string(),
                /** What the QR encodes, as on the Receive screen. */
                paymentUri: z.string(),
                /** CAIP-2 id of the account's receive network, so a tap opens it on that chain. */
                chain: z.string().nullable(),
            }),
        )
        .nullable(),
})

export type WidgetSnapshot = z.infer<typeof widgetSnapshotSchema>

export type WidgetTheme = WidgetSnapshot['theme']

export type WidgetPriceFeed = WidgetSnapshot['priceFeed']
export type WidgetPortfolioFeed = WidgetSnapshot['portfolioFeed']

export type WidgetBackup = z.infer<typeof widgetBackupSchema>

export type WidgetInboxFeed = WidgetSnapshot['inboxFeed']

export type WidgetReceiveTarget = NonNullable<
    WidgetSnapshot['receiveTargets']
>[number]

export type WidgetAssetOption = NonNullable<
    WidgetSnapshot['assetOptions']
>[number]

export type WidgetNftCandidate = {
    /** Decimal string; can exceed 2^53. */
    assetId: string
    title: string
    collectionName?: string
    imageUrl: string
}

/**
 * `undefined` on any field means "still loading". `value: null` means the
 * amount is genuinely unknown (no rate), which the widget shows as absent.
 */
export type BuildWidgetSnapshotInput = {
    locale: string
    theme: WidgetTheme
    network: { isMainnet: boolean; label: string }
    strings: Record<string, string>
    priceFeed: WidgetPriceFeed
    portfolioFeed: WidgetPortfolioFeed
    /** `undefined` while loading; written as empty rather than waited on. */
    assetOptions: WidgetAssetOption[] | undefined
    isPrivacyMode: boolean
    hasAccounts: boolean
    /** Price of one ALGO, display units of `currencyCode`. */
    algoPrice:
        | { value: Nullable<Decimal>; currencyCode: string; asOf: number }
        | undefined
    /** Portfolio value, display units of `currencyCode`; `algoValue` in ALGO. */
    portfolio:
        | {
              value: Nullable<Decimal>
              currencyCode: string
              /** Null when any account's value is unknown. */
              algoValue: Nullable<Decimal>
              asOf: number
          }
        | undefined
    nfts: WidgetNftCandidate[] | undefined
    cachedImageKeys: string[]
    backup: WidgetBackup | undefined
    receiveTargets: WidgetReceiveTarget[]
    inboxFeed: WidgetInboxFeed
}

const formatAmount = (
    value: Decimal,
    precision: number,
    currencyCode: string,
    locale: string,
) => {
    const formatted = formatCurrency(value, precision, currencyCode, locale)
    // formatCurrency omits the symbol for ALGO, so name the unit explicitly.
    return isAlgoAssetName(currencyCode) ? `${formatted} ALGO` : formatted
}

const portfolioSection = ({
    hasAccounts,
    isPrivacyMode,
    portfolio,
    locale,
}: BuildWidgetSnapshotInput): WidgetSnapshot['portfolio'] => {
    if (!hasAccounts) return null
    if (isPrivacyMode) return { state: 'hidden' }
    if (!portfolio || portfolio.algoValue === null) return null
    return {
        state: 'visible',
        formatted:
            portfolio.value === null
                ? null
                : formatAmount(
                      portfolio.value,
                      FIAT_PRECISION,
                      portfolio.currencyCode,
                      locale,
                  ),
        algoFormatted: formatAmount(
            portfolio.algoValue,
            FIAT_PRECISION,
            'ALGO',
            locale,
        ),
        asOf: portfolio.asOf,
    }
}

const nftsSection = (
    { hasAccounts, isPrivacyMode, nfts }: BuildWidgetSnapshotInput,
    cached: ReadonlySet<string>,
): WidgetSnapshot['nfts'] => {
    if (!hasAccounts) return null
    if (isPrivacyMode) return { state: 'hidden' }
    return {
        state: 'visible',
        items: (nfts ?? [])
            .filter(item => cached.has(item.assetId))
            .slice(0, MAX_WIDGET_NFTS)
            .map(item => ({
                assetId: item.assetId,
                title: item.title,
                ...(item.collectionName
                    ? { collectionName: item.collectionName }
                    : {}),
                imageKey: item.assetId,
            })),
    }
}

export const buildWidgetSnapshot = (
    input: BuildWidgetSnapshotInput,
): WidgetSnapshot | undefined => {
    const {
        locale,
        isPrivacyMode,
        hasAccounts,
        algoPrice,
        portfolio,
        nfts,
        backup,
    } = input

    if (algoPrice === undefined) return undefined
    if (hasAccounts && backup === undefined) return undefined
    if (hasAccounts && !isPrivacyMode) {
        if (portfolio === undefined || nfts === undefined) return undefined
    }

    const cached = new Set(input.cachedImageKeys)

    return {
        version: WIDGET_SNAPSHOT_VERSION,
        locale,
        theme: input.theme,
        network: input.network,
        strings: input.strings,
        priceFeed: input.priceFeed,
        portfolioFeed: isPrivacyMode ? null : input.portfolioFeed,
        assetOptions: isPrivacyMode ? null : (input.assetOptions ?? []),
        algoPrice:
            algoPrice.value === null
                ? null
                : {
                      formatted: formatAmount(
                          algoPrice.value,
                          PRICE_PRECISION,
                          algoPrice.currencyCode,
                          locale,
                      ),
                      asOf: algoPrice.asOf,
                  },
        portfolio: portfolioSection(input),
        nfts: nftsSection(input, cached),
        backup: hasAccounts ? (backup ?? null) : null,
        receiveTargets: isPrivacyMode ? null : input.receiveTargets,
        inboxFeed: isPrivacyMode ? null : input.inboxFeed,
    }
}

// NFT metadata URLs are untrusted; the native side re-checks the scheme, and
// keys become file names, so only plain asset ids pass.
export const selectWidgetNftImages = (
    candidates: WidgetNftCandidate[],
): WidgetImageRequest[] =>
    candidates
        .filter(
            item =>
                ASSET_ID_PATTERN.test(item.assetId) &&
                httpsUrlSchema.safeParse(item.imageUrl).success,
        )
        .slice(0, MAX_WIDGET_NFTS)
        .map(item => ({ key: item.assetId, url: item.imageUrl }))
