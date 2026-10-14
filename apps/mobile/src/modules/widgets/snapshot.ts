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

export const widgetSnapshotSchema = z.object({
    version: z.literal(WIDGET_SNAPSHOT_VERSION),
    locale: z.string(),
    theme: z.enum(['light', 'dark', 'system']),
    network: z.object({ isMainnet: z.boolean(), label: z.string() }),
    strings: z.record(z.string(), z.string()),
    algoPrice: z.object({ formatted: z.string(), asOf: z.number() }).nullable(),
    portfolio: z
        .discriminatedUnion('state', [
            z.object({
                state: z.literal('visible'),
                formatted: z.string(),
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
})

export type WidgetSnapshot = z.infer<typeof widgetSnapshotSchema>

export type WidgetTheme = WidgetSnapshot['theme']

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
              algoValue: Decimal
              asOf: number
          }
        | undefined
    nfts: WidgetNftCandidate[] | undefined
    cachedImageKeys: string[]
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

export const buildWidgetSnapshot = (
    input: BuildWidgetSnapshotInput,
): WidgetSnapshot | undefined => {
    const { locale, isPrivacyMode, hasAccounts, algoPrice, portfolio, nfts } =
        input

    if (algoPrice === undefined) return undefined
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
        portfolio: !hasAccounts
            ? null
            : isPrivacyMode
              ? { state: 'hidden' }
              : portfolio?.value == null
                ? null
                : {
                      state: 'visible',
                      formatted: formatAmount(
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
                  },
        nfts: !hasAccounts
            ? null
            : isPrivacyMode
              ? { state: 'hidden' }
              : {
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
                },
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
