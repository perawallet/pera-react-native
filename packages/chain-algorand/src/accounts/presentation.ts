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
import { i18nKey, type I18nKey } from '@perawallet/wallet-core-chain-contract'
import { config } from '@perawallet/wallet-core-config'
import { ALGORAND_CHAIN_ID } from '../chain-id'
import { algorandKeyKindOptions } from './key-kind-options'
import { AccountTypes, type AccountType } from './vocabulary'

const KIND_COPY: Record<AccountType, AccountKindPresentation> = {
    [AccountTypes.standalone]: {
        labelKey: i18nKey('account_info.type_algo25'),
        infoTitleKey: i18nKey('account_type_info.standard_title'),
        infoBodyKey: i18nKey('account_type_info.standard_description'),
        glyph: 'accounts/glyph/algo25-account',
        supportUrl: config.accountTypeSupportUrl,
        unreachableChainsNoteKey: i18nKey(
            'account_type_info.standard_unreachable_chains_note',
        ),
    },
    [AccountTypes.hdWallet]: {
        labelKey: i18nKey('account_info.type_universal_wallet'),
        infoTitleKey: i18nKey('account_type_info.hd_wallet_title'),
        infoBodyKey: i18nKey('account_type_info.hd_wallet_description'),
        glyph: 'accounts/glyph/hdwallet-account',
        supportUrl: config.accountTypeSupportUrl,
    },
    [AccountTypes.hardware]: {
        labelKey: i18nKey('account_info.type_ledger'),
        infoTitleKey: i18nKey('account_type_info.ledger_title'),
        infoBodyKey: i18nKey('account_type_info.ledger_description'),
        glyph: 'accounts/glyph/ledger-account',
        delegatedGlyph: 'accounts/glyph/rekeyed-ledger',
        supportUrl: config.ledgerAccountSupportUrl,
    },
    [AccountTypes.multisig]: {
        labelKey: i18nKey('account_info.type_multisig'),
        infoTitleKey: i18nKey('account_type_info.multisig_title'),
        infoBodyKey: i18nKey('account_type_info.multisig_description'),
        glyph: 'accounts/glyph/multisig-account',
        delegatedGlyph: 'accounts/glyph/rekeyed-multisig',
        supportUrl: config.multisigSupportUrl,
    },
    [AccountTypes.watch]: {
        labelKey: i18nKey('account_info.type_watch'),
        infoTitleKey: i18nKey('account_type_info.watch_title'),
        infoBodyKey: i18nKey('account_type_info.watch_description'),
        glyph: 'accounts/glyph/watch-account',
        supportUrl: config.accountTypeSupportUrl,
    },
    [AccountTypes.quantum]: {
        labelKey: i18nKey('account_info.type_quantum'),
        infoTitleKey: i18nKey('account_type_info.quantum_title'),
        infoBodyKey: i18nKey('account_type_info.quantum_description'),
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
    labelKey: i18nKey('account_info.type_no_auth'),
    infoTitleKey: i18nKey('account_type_info.no_auth_title'),
    infoBodyKey: i18nKey('account_type_info.multisig_no_auth_description'),
}

const SIGNER_KEY: Record<AccountType, I18nKey> = {
    [AccountTypes.standalone]: i18nKey('account_info.rekey_signer_standard'),
    [AccountTypes.hdWallet]: i18nKey('account_info.rekey_signer_standard'),
    [AccountTypes.hardware]: i18nKey('account_info.rekey_signer_ledger'),
    [AccountTypes.multisig]: i18nKey('account_info.rekey_signer_shared'),
    [AccountTypes.watch]: i18nKey('account_info.rekey_signer_watch'),
    [AccountTypes.quantum]: i18nKey('account_info.rekey_signer_quantum'),
}

const transitionDescriptionKey = (
    from: AccountType,
    to: AccountType,
): I18nKey => {
    if (to === AccountTypes.multisig) {
        return i18nKey('account_type_info.rekeyed_shared_description')
    }
    if (from === AccountTypes.hardware && to === AccountTypes.hardware) {
        return i18nKey('account_type_info.rekeyed_ledger_to_ledger_description')
    }
    if (to === AccountTypes.hardware) {
        return i18nKey('account_type_info.rekeyed_ledger_description')
    }
    if (to === AccountTypes.quantum) {
        return i18nKey('account_type_info.rekeyed_quantum_description')
    }
    return i18nKey('account_type_info.rekeyed_standard_description')
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
        labelKey: i18nKey('account_info.type_rekeyed_signer'),
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
