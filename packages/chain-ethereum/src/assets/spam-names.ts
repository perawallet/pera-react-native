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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    isSpamAssetText,
    PeraAssetVerificationTier,
    type DisplayableAsset,
} from '@perawallet/wallet-core-assets'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import type { ListedTokens } from './api/whitelist-cache'

const symbolOf = (unitName: string): string =>
    unitName.trim().replace(/^\$/, '').trim().toUpperCase()

/**
 * Whether an ERC-20's own name or symbol advertises a scam: a link, a lure
 * emoji, a call to claim, or a symbol copied from a listed token.
 * `listedSymbols` are upper-cased. The caller keeps a listed contract out of
 * the symbol rule only; its name is still checked.
 */
export const isSpamNamedToken = (
    token: { name?: Nullable<string>; unitName?: Nullable<string> },
    listedSymbols: ReadonlySet<string>,
): boolean => {
    const texts = [token.name, token.unitName].filter(
        (text): text is string => !!text,
    )
    if (texts.some(isSpamAssetText)) return true
    return !!token.unitName && listedSymbols.has(symbolOf(token.unitName))
}

/**
 * Whether a token Pera hasn't vetted should be stored as suspicious for its
 * name. `hasBackendRecord` turns off the look-alike symbol rule: a real
 * bridged token (Arbitrum's USDC) shares a listed symbol on another contract,
 * so only a token the backend has never seen is judged by its symbol.
 */
export type SpamCheck = (
    asset: DisplayableAsset,
    hasBackendRecord: boolean,
) => Promise<boolean>

const NO_SYMBOLS: ReadonlySet<string> = new Set()

type Listed = { symbols: ReadonlySet<string>; ids: ReadonlySet<string> }

/**
 * One check per sync pass. The token list is read only once a name gets past
 * the link and wording rules, and a failed read leaves just the native symbol
 * to compare against: a missed look-alike beats a flagged real token.
 */
export const spamCheckFor = (
    listedTokens: ListedTokens,
    nativeSymbol: string,
    scope: ChainScope,
): SpamCheck => {
    const native = nativeSymbol.toUpperCase()
    let listed: Optional<Promise<Listed>>
    const readListed = (): Promise<Listed> =>
        (listed ??= listedTokens(scope).then(
            rows => ({
                symbols: new Set([
                    native,
                    ...rows.flatMap(row =>
                        row.asset.unitName
                            ? [row.asset.unitName.toUpperCase()]
                            : [],
                    ),
                ]),
                ids: new Set(rows.map(row => row.assetId)),
            }),
            () => ({ symbols: new Set([native]), ids: new Set<string>() }),
        ))
    return async (asset, hasBackendRecord) => {
        const tier = asset.peraMetadata?.verificationTier
        if (
            tier === PeraAssetVerificationTier.verified ||
            tier === PeraAssetVerificationTier.suspicious
        ) {
            return false
        }
        if (isSpamNamedToken(asset, NO_SYMBOLS)) return true
        if (hasBackendRecord) return false
        const { symbols, ids } = await readListed()
        return !ids.has(asset.assetId) && isSpamNamedToken(asset, symbols)
    }
}
