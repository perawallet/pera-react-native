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
import { i18nKey } from '@perawallet/wallet-core-chain-contract'
import { config } from '@perawallet/wallet-core-config'
import { SeedScheme } from '@perawallet/wallet-core-kms/constants'

const HD_OPTIONS: LocalKeyKindOptions = {
    recover: {
        id: 'hd_wallet',
        titleKey: i18nKey('onboarding.import_options.hd_wallet.title'),
        descriptionKey: i18nKey(
            'onboarding.import_options.hd_wallet.description',
        ),
        isSuggested: true,
        order: 0,
        analyticsEvent: 'onb_createacc_recover_24',
    },
}

const STANDALONE_OPTIONS: LocalKeyKindOptions = {
    recover: {
        id: 'algo25',
        titleKey: i18nKey('onboarding.import_options.algo25.title'),
        chipKey: i18nKey('onboarding.import_options.algo25.chip'),
        descriptionKey: i18nKey('onboarding.import_options.algo25.description'),
        isSuggested: false,
        order: 2,
        analyticsEvent: 'onb_createacc_recover_25',
    },
    create: {
        id: 'algo25',
        titleKey: i18nKey('onboarding.add_account.create_algo25_option_title'),
        descriptionKey: i18nKey(
            'onboarding.add_account.create_algo25_option_description',
        ),
        icon: 'wallet',
        isFeatured: false,
    },
}

const QUANTUM_OPTIONS: LocalKeyKindOptions = {
    create: {
        id: 'quantum',
        titleKey: i18nKey(
            'onboarding.add_account.quantum_account_option_title',
        ),
        descriptionKey: i18nKey(
            'onboarding.add_account.quantum_account_option_description',
        ),
        icon: 'quantum',
        isFeatured: true,
        // Falcon keygen is heavier than Ed25519.
        progressTitleKey: i18nKey(
            'onboarding.add_account.quantum_creating_title',
        ),
        badgeKey: i18nKey(
            'onboarding.add_account.quantum_account_option_badge',
        ),
        learnMore: {
            labelKey: i18nKey(
                'onboarding.add_account.quantum_account_option_learn_more',
            ),
            url: config.quantumAccountSupportUrl,
        },
        analyticsEvent: 'createacc_quantumAccount_press',
    },
    recover: {
        id: 'quantum',
        titleKey: i18nKey('onboarding.import_options.quantum.title'),
        descriptionKey: i18nKey(
            'onboarding.import_options.quantum.description',
        ),
        isSuggested: false,
        order: 1,
    },
}

const OPTIONS_BY_SEED: readonly [LocalKeySeed, LocalKeyKindOptions][] = [
    [SeedScheme.Bip39, HD_OPTIONS],
    [null, STANDALONE_OPTIONS],
    [SeedScheme.Quantum, QUANTUM_OPTIONS],
]

export const algorandKeyKindOptions = (
    seed: LocalKeySeed,
): LocalKeyKindOptions | undefined =>
    OPTIONS_BY_SEED.find(([candidate]) => candidate === seed)?.[1]
