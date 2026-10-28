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
    type I18nKey,
} from '@perawallet/wallet-core-chain-contract'
import type { AccountKindId, LocalKeySeed } from './chain-adapter'

/** How an account kind is shown. Keys are i18n keys; glyphs are ids the app maps to icons. */
export type AccountKindPresentation = {
    labelKey: I18nKey
    infoTitleKey: I18nKey
    infoBodyKey: I18nKey
    glyph: string
    /** The glyph an account delegated to this kind shows; absent uses the generic one. */
    delegatedGlyph?: string
    supportUrl?: string
    /** Why an account of this kind is missing from chains its custody can't reach; absent shows no note. */
    unreachableChainsNoteKey?: I18nKey
}

/** What a kind's copy may depend on besides the kind. */
export type AccountKindContext = {
    /** Whether a held account signs for the account on the scope it's shown on. */
    canSign: boolean
}

/** The copy for an account whose authority moved from one kind to another. */
export type AuthorityTransitionLabel = {
    /** Interpolates the signer copy as `to`. */
    labelKey: I18nKey
    signerKey: I18nKey
    descriptionKey: I18nKey
    supportUrl?: string
}

/** A screen row that mints or imports one key kind; every `*Key` is an i18n key. */
export type LocalKeyEntryOption = {
    /** Stable slug the row's test id is built from. */
    id: string
    titleKey: I18nKey
    descriptionKey: I18nKey
    /** A name from the app's icon set. */
    icon: string
}

/** How the add-account screen offers minting a key kind. */
export type LocalKeyCreateOption = LocalKeyEntryOption & {
    /** Listed among the screen's main options rather than under its other options. */
    isFeatured: boolean
    /** Replaces the screen's progress title while the key is generated. */
    progressTitleKey?: I18nKey
    badgeKey?: I18nKey
    learnMore?: { labelKey: I18nKey; url: string }
    /** Analytics event logged when the user picks the option. */
    analyticsEvent?: string
}

/** How the recover-a-wallet chooser offers a key kind; every `*Key` is an i18n key. */
export type LocalKeyRecoverOption = {
    /** Stable slug the option's test id is built from. */
    id: string
    titleKey: I18nKey
    chipKey: I18nKey
    descriptionKey: I18nKey
    mnemonicInfoKey: I18nKey
    /** Gives the chip the emphasis of the chain's suggested kind. */
    isSuggested: boolean
    /** Analytics event logged when the user picks the option. */
    analyticsEvent: string
}

/** How the onboarding screens offer one local key kind; an absent entry leaves that screen without a row for it. */
export type LocalKeyKindOptions = {
    recover?: LocalKeyRecoverOption
    create?: LocalKeyCreateOption
    import?: LocalKeyEntryOption
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
    /** Undefined for a key kind (`LocalKeyKind.seed`) the onboarding screens don't offer. */
    keyKindOptions?(seed: LocalKeySeed): LocalKeyKindOptions | undefined
}

export const accountPresentationChainAdapters =
    createChainAdapterRegistry<AccountPresentationChainAdapter>(
        'account-presentation',
    )
