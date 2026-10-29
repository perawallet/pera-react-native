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

import type { ComponentType } from 'react'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import type {
    ChainDescriptor,
    ChainScope,
    I18nKey,
} from '@perawallet/wallet-core-chain-contract'
import type { Decimal } from 'decimal.js'
import type { Nullable } from '@perawallet/wallet-core-shared'

export type AssetChainSectionProps = {
    asset: PeraAsset
    scope: ChainScope
}

export type AssetExplorerLink = { url: string; label: string }

export type AssetDisplayParams = {
    asset: PeraAsset
    scope: ChainScope
    descriptor: ChainDescriptor
    isNativeAsset: boolean
}

/** Labels are i18n keys; a null `idLabelKey` hides the id row. */
export type AssetAboutDisplay = {
    idLabelKey: Nullable<I18nKey>
    urlLabelKey: I18nKey
    explorerLink: Nullable<AssetExplorerLink>
}

/** `amount` is in base units; null renders as "—". `labelKey` also titles the info sheet. */
export type AssetSupplyDisplay = {
    labelKey: I18nKey
    infoBodyKey: I18nKey
    amount: Nullable<Decimal>
}

/** What one chain family adds to the asset detail screen; a family with no entry gets the neutral layout. */
export type AssetDetailsDisplay = {
    /** Renders on the Markets tab, after About. */
    VerificationSection?: ComponentType<AssetChainSectionProps>
    /** Renders on the Markets tab, after the description. */
    IssuerControlsSection?: ComponentType<AssetChainSectionProps>
    resolveAbout: (params: AssetDisplayParams) => AssetAboutDisplay
    resolveSupply: (params: AssetDisplayParams) => AssetSupplyDisplay
}
