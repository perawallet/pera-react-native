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

import type {
    AccountKindPresentation,
    AccountPresentationOps,
    AuthorityTransitionLabel,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { config } from '@perawallet/wallet-core-config'
import { resolveAlgorandSigner } from './signer-resolution'
import { accountType, AccountTypes, type AccountType } from './vocabulary'

type KindCopy = Omit<AccountKindPresentation, 'kindId' | 'analyticsKind'>

const KIND_COPY: Record<AccountType, KindCopy> = {
    [AccountTypes.standalone]: {
        labelKey: 'account_info.type_algo25',
        infoTitleKey: 'account_type_info.standard_title',
        infoBodyKey: 'account_type_info.standard_description',
        glyph: 'accounts/glyph/algo25-account',
        supportUrl: config.accountTypeSupportUrl,
    },
    [AccountTypes.hdWallet]: {
        labelKey: 'account_info.type_universal_wallet',
        infoTitleKey: 'account_type_info.hd_wallet_title',
        infoBodyKey: 'account_type_info.hd_wallet_description',
        glyph: 'accounts/glyph/hdwallet-account',
        supportUrl: config.accountTypeSupportUrl,
    },
    [AccountTypes.hardware]: {
        labelKey: 'account_info.type_ledger',
        infoTitleKey: 'account_type_info.ledger_title',
        infoBodyKey: 'account_type_info.ledger_description',
        glyph: 'accounts/glyph/ledger-account',
        rekeyedGlyph: 'accounts/glyph/rekeyed-ledger',
        supportUrl: config.ledgerAccountSupportUrl,
    },
    [AccountTypes.multisig]: {
        labelKey: 'account_info.type_multisig',
        infoTitleKey: 'account_type_info.multisig_title',
        infoBodyKey: 'account_type_info.multisig_description',
        glyph: 'accounts/glyph/multisig-account',
        rekeyedGlyph: 'accounts/glyph/rekeyed-multisig',
        supportUrl: config.multisigSupportUrl,
    },
    [AccountTypes.watch]: {
        labelKey: 'account_info.type_watch',
        infoTitleKey: 'account_type_info.watch_title',
        infoBodyKey: 'account_type_info.watch_description',
        glyph: 'accounts/glyph/watch-account',
        supportUrl: config.accountTypeSupportUrl,
    },
    [AccountTypes.quantum]: {
        labelKey: 'account_info.type_quantum',
        infoTitleKey: 'account_type_info.quantum_title',
        infoBodyKey: 'account_type_info.quantum_description',
        glyph: 'accounts/glyph/quantum-account',
        supportUrl: config.quantumAccountSupportUrl,
    },
}

// A multisig with no participant held locally can't sign, so it reads as a
// no-auth account rather than as a shared one.
const UNSIGNABLE_MULTISIG_COPY: Pick<
    KindCopy,
    'labelKey' | 'infoTitleKey' | 'infoBodyKey'
> = {
    labelKey: 'account_info.type_no_auth',
    infoTitleKey: 'account_type_info.no_auth_title',
    infoBodyKey: 'account_type_info.multisig_no_auth_description',
}

const SIGNER_KEY: Record<AccountType, string> = {
    [AccountTypes.standalone]: 'account_info.rekey_signer_standard',
    [AccountTypes.hdWallet]: 'account_info.rekey_signer_standard',
    [AccountTypes.hardware]: 'account_info.rekey_signer_ledger',
    [AccountTypes.multisig]: 'account_info.rekey_signer_shared',
    [AccountTypes.watch]: 'account_info.rekey_signer_watch',
    [AccountTypes.quantum]: 'account_info.rekey_signer_quantum',
}

const transitionDescriptionKey = (from: AccountType, to: AccountType) => {
    if (to === AccountTypes.multisig) {
        return 'account_type_info.rekeyed_shared_description'
    }
    if (from === AccountTypes.hardware && to === AccountTypes.hardware) {
        return 'account_type_info.rekeyed_ledger_to_ledger_description'
    }
    if (to === AccountTypes.hardware) {
        return 'account_type_info.rekeyed_ledger_description'
    }
    if (to === AccountTypes.quantum) {
        return 'account_type_info.rekeyed_quantum_description'
    }
    return 'account_type_info.rekeyed_standard_description'
}

const describe = (
    account: WalletAccount,
    accounts: readonly WalletAccount[],
    scope: ChainScope,
): AccountKindPresentation => {
    const type = accountType(account)
    const copy = KIND_COPY[type]
    const isUnsignableMultisig =
        type === AccountTypes.multisig &&
        resolveAlgorandSigner(account, [...accounts], scope).kind !== 'ok'
    return {
        kindId: type,
        analyticsKind: type,
        ...copy,
        ...(isUnsignableMultisig ? UNSIGNABLE_MULTISIG_COPY : {}),
    }
}

// The backup wire format still spells the standalone kind `algo25`.
const WIRE_KIND_IDS: Readonly<Record<string, AccountType>> = {
    algo25: AccountTypes.standalone,
}

const kindGlyph = (kindId: string): string | undefined => {
    if (Object.hasOwn(KIND_COPY, kindId)) {
        return KIND_COPY[kindId as AccountType].glyph
    }
    return Object.hasOwn(WIRE_KIND_IDS, kindId)
        ? KIND_COPY[WIRE_KIND_IDS[kindId]].glyph
        : undefined
}

const transitionLabel = (
    from: WalletAccount,
    to: WalletAccount,
): AuthorityTransitionLabel => {
    const fromType = accountType(from)
    const toType = accountType(to)
    return {
        labelKey: 'account_info.type_rekeyed_signer',
        signerKey: SIGNER_KEY[toType],
        descriptionKey: transitionDescriptionKey(fromType, toType),
        supportUrl: KIND_COPY[toType].supportUrl,
    }
}

export const algorandAccountPresentation: AccountPresentationOps = {
    describe,
    kindGlyph,
    transitionLabel,
}

/** Every i18n key the presentation emits as data, for the literal-`t()` lint. */
export const accountPresentationI18nKeys = (): readonly string[] => [
    ...Object.values(KIND_COPY).flatMap(copy => [
        copy.labelKey,
        copy.infoTitleKey,
        copy.infoBodyKey,
    ]),
    UNSIGNABLE_MULTISIG_COPY.labelKey,
    UNSIGNABLE_MULTISIG_COPY.infoTitleKey,
    UNSIGNABLE_MULTISIG_COPY.infoBodyKey,
    'account_info.type_rekeyed_signer',
    ...Object.values(SIGNER_KEY),
    'account_type_info.rekeyed_shared_description',
    'account_type_info.rekeyed_ledger_to_ledger_description',
    'account_type_info.rekeyed_ledger_description',
    'account_type_info.rekeyed_quantum_description',
    'account_type_info.rekeyed_standard_description',
]
