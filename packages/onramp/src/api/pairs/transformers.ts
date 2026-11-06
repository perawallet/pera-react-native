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

import type { RampToken, RampTokenKind } from '../../models'
import type { Nullable } from '@perawallet/wallet-core-shared'

import { knownFractionDecimalsOf, toRampToken } from '../router-asset'
import type { RampPairRowApiResponse } from './schema'

const isTokenKind = (kind: unknown): kind is RampTokenKind =>
    kind === 'token' || kind === 'deposit' || kind === 'fiat'

/**
 * The row's own kind when it names one the app knows, else read off the asset.
 * Null for an asset that gives no decimals: its amounts couldn't be scaled.
 */
export const transformRampPairRow = (
    row: RampPairRowApiResponse,
): Nullable<RampToken> => {
    const kind = isTokenKind(row.kind) ? row.kind : undefined
    return knownFractionDecimalsOf(row.asset, kind) === null
        ? null
        : toRampToken(row.asset, kind)
}

/** First occurrence wins: a coin listed by two aggregators is one row. */
export const dedupeRampTokens = (tokens: RampToken[]): RampToken[] => {
    const seen = new Set<string>()
    return tokens.filter(token => {
        if (seen.has(token.id)) return false
        seen.add(token.id)
        return true
    })
}
