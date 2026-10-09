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

import {
    createChainAdapterRegistry,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import type { AccountKindId } from './chain-adapter'

/** How an account kind is shown. Keys are i18n keys; glyphs are ids the app maps to icons. */
export type AccountKindPresentation = {
    labelKey: string
    infoTitleKey: string
    infoBodyKey: string
    glyph: string
    /** The glyph an account delegated to this kind shows; absent uses the generic one. */
    rekeyedGlyph?: string
    supportUrl?: string
}

/** What a kind's copy may depend on besides the kind. */
export type AccountKindContext = {
    /** Whether a held account signs for the account on the scope it's shown on. */
    canSign: boolean
}

/** The copy for an account whose authority moved from one kind to another. */
export type AuthorityTransitionLabel = {
    /** Interpolates the signer copy as `to`. */
    labelKey: string
    signerKey: string
    descriptionKey: string
    supportUrl?: string
}

/**
 * The accounts feature's UI copy for a chain, keyed by the kind ids its
 * `AccountsChainAdapter.kindIdOf` gives. A chain without one shows the app's
 * generic copy.
 */
export interface AccountPresentationChainAdapter {
    readonly chainId: ChainId
    /**
     * Undefined for a kind id the chain doesn't describe. Only the copy may
     * follow `context`; the glyphs depend on the kind alone, so a kind shown
     * without an account (an address held only in a backup) gets the same one.
     */
    describe(
        kindId: AccountKindId,
        context: AccountKindContext,
    ): AccountKindPresentation | undefined
    /** Present only on a chain whose accounts adapter has `authority`. */
    transitionLabel?(
        from: AccountKindId,
        to: AccountKindId,
    ): AuthorityTransitionLabel | undefined
}

export const accountPresentationChainAdapters =
    createChainAdapterRegistry<AccountPresentationChainAdapter>(
        'account-presentation',
    )
