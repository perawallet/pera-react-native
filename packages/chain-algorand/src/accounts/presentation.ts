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
    AccountKindContext,
    AccountKindPresentation,
    AccountPresentationChainAdapter,
    AuthorityTransitionLabel,
} from '@perawallet/wallet-core-accounts'
import { config } from '@perawallet/wallet-core-config'
import { ALGORAND_CHAIN_ID } from '../chain-id'
import { algorandKeyKindOptions } from './key-kind-options'
import { AccountTypes, type AccountType } from './vocabulary'

const KIND_COPY: Record<AccountType, AccountKindPresentation> = {
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
    AccountKindPresentation,
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

// A kind id is the accounts adapter's `kindIdOf`, which is the account type.
const isAccountType = (kindId: string): kindId is AccountType =>
    Object.hasOwn(KIND_COPY, kindId)

const describe = (
    kindId: string,
    { canSign }: AccountKindContext,
): AccountKindPresentation | undefined => {
    if (!isAccountType(kindId)) return undefined
    const isUnsignableMultisig = kindId === AccountTypes.multisig && !canSign
    return {
        ...KIND_COPY[kindId],
        ...(isUnsignableMultisig ? UNSIGNABLE_MULTISIG_COPY : {}),
    }
}

const transitionLabel = (
    from: string,
    to: string,
): AuthorityTransitionLabel | undefined => {
    if (!isAccountType(from) || !isAccountType(to)) return undefined
    return {
        labelKey: 'account_info.type_rekeyed_signer',
        signerKey: SIGNER_KEY[to],
        descriptionKey: transitionDescriptionKey(from, to),
        supportUrl: KIND_COPY[to].supportUrl,
    }
}

export const algorandAccountPresentation: AccountPresentationChainAdapter = {
    chainId: ALGORAND_CHAIN_ID,
    describe,
    transitionLabel,
    keyKindOptions: algorandKeyKindOptions,
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
