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
    LocalKeyKindOptions,
    LocalKeySeed,
} from '@perawallet/wallet-core-accounts'
import { config } from '@perawallet/wallet-core-config'
import { SeedScheme } from '@perawallet/wallet-core-kms/constants'

const HD_OPTIONS: LocalKeyKindOptions = {
    recover: {
        id: 'hd_wallet',
        titleKey: 'onboarding.import_options.hd_wallet.title',
        chipKey: 'onboarding.import_options.hd_wallet.chip',
        descriptionKey: 'onboarding.import_options.hd_wallet.description',
        mnemonicInfoKey: 'onboarding.import_options.mnemonic_info',
        isSuggested: true,
        analyticsEvent: 'onb_createacc_recover_24',
    },
}

const STANDALONE_OPTIONS: LocalKeyKindOptions = {
    recover: {
        id: 'algo25',
        titleKey: 'onboarding.import_options.algo25.title',
        chipKey: 'onboarding.import_options.algo25.chip',
        descriptionKey: 'onboarding.import_options.algo25.description',
        mnemonicInfoKey: 'onboarding.import_options.algo25.mnemonic_info',
        isSuggested: false,
        analyticsEvent: 'onb_createacc_recover_25',
    },
    create: {
        id: 'algo25',
        titleKey: 'onboarding.add_account.create_algo25_option_title',
        descriptionKey:
            'onboarding.add_account.create_algo25_option_description',
        icon: 'wallet',
        isFeatured: false,
    },
}

const QUANTUM_OPTIONS: LocalKeyKindOptions = {
    create: {
        id: 'quantum',
        titleKey: 'onboarding.add_account.quantum_account_option_title',
        descriptionKey:
            'onboarding.add_account.quantum_account_option_description',
        icon: 'quantum',
        isFeatured: true,
        // Falcon keygen is heavier than Ed25519.
        progressTitleKey: 'onboarding.add_account.quantum_creating_title',
        badgeKey: 'onboarding.add_account.quantum_account_option_badge',
        learnMore: {
            labelKey:
                'onboarding.add_account.quantum_account_option_learn_more',
            url: config.quantumAccountSupportUrl,
        },
        analyticsEvent: 'createacc_quantumAccount_press',
    },
    import: {
        id: 'quantum',
        titleKey: 'onboarding.import_account_options.quantum_title',
        descriptionKey: 'onboarding.import_account_options.quantum_description',
        icon: 'quantum',
    },
}

// Ordered as `algorandLocalKeyKinds`, so the i18n key list reads the same way.
const OPTIONS_BY_SEED: readonly [LocalKeySeed, LocalKeyKindOptions][] = [
    [SeedScheme.Bip39, HD_OPTIONS],
    [null, STANDALONE_OPTIONS],
    [SeedScheme.Quantum, QUANTUM_OPTIONS],
]

export const algorandKeyKindOptions = (
    seed: LocalKeySeed,
): LocalKeyKindOptions | undefined =>
    OPTIONS_BY_SEED.find(([candidate]) => candidate === seed)?.[1]

/** Every i18n key the key-kind options name, for the literal-`t()` lint. */
export const keyKindOptionI18nKeys = (): readonly string[] =>
    OPTIONS_BY_SEED.flatMap(([, { recover, create, import: entry }]) => [
        ...(recover
            ? [
                  recover.titleKey,
                  recover.chipKey,
                  recover.descriptionKey,
                  recover.mnemonicInfoKey,
              ]
            : []),
        ...(create
            ? [
                  create.titleKey,
                  create.descriptionKey,
                  ...(create.progressTitleKey ? [create.progressTitleKey] : []),
                  ...(create.badgeKey ? [create.badgeKey] : []),
                  ...(create.learnMore ? [create.learnMore.labelKey] : []),
              ]
            : []),
        ...(entry ? [entry.titleKey, entry.descriptionKey] : []),
    ])
