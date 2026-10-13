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

import { describe, expect, it } from 'vitest'
import { config } from '@perawallet/wallet-core-config'
import { SeedScheme } from '@perawallet/wallet-core-kms'
import {
    algorandKeyKindOptions,
    keyKindOptionI18nKeys,
} from '../key-kind-options'
import { algorandLocalKeyKinds } from '../local-key-kinds'
import { algorandAccountPresentation } from '../presentation'

describe('algorandKeyKindOptions', () => {
    it('offers the HD kind only from the recover chooser, as the suggested kind', () => {
        expect(algorandKeyKindOptions(SeedScheme.Bip39)).toEqual({
            recover: {
                id: 'hd_wallet',
                titleKey: 'onboarding.import_options.hd_wallet.title',
                chipKey: 'onboarding.import_options.hd_wallet.chip',
                descriptionKey:
                    'onboarding.import_options.hd_wallet.description',
                mnemonicInfoKey: 'onboarding.import_options.mnemonic_info',
                isSuggested: true,
                analyticsEvent: 'onb_createacc_recover_24',
            },
        })
    })

    it('offers the standalone kind from the recover chooser and as an other create option', () => {
        expect(algorandKeyKindOptions(null)).toEqual({
            recover: {
                id: 'algo25',
                titleKey: 'onboarding.import_options.algo25.title',
                chipKey: 'onboarding.import_options.algo25.chip',
                descriptionKey: 'onboarding.import_options.algo25.description',
                mnemonicInfoKey:
                    'onboarding.import_options.algo25.mnemonic_info',
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
        })
    })

    it('offers the quantum kind as a featured create option and its own import row', () => {
        expect(algorandKeyKindOptions(SeedScheme.Quantum)).toEqual({
            create: {
                id: 'quantum',
                titleKey: 'onboarding.add_account.quantum_account_option_title',
                descriptionKey:
                    'onboarding.add_account.quantum_account_option_description',
                icon: 'quantum',
                isFeatured: true,
                progressTitleKey:
                    'onboarding.add_account.quantum_creating_title',
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
                descriptionKey:
                    'onboarding.import_account_options.quantum_description',
                icon: 'quantum',
            },
        })
    })

    it('offers every kind the accounts adapter mints', () => {
        for (const kind of algorandLocalKeyKinds) {
            expect(algorandKeyKindOptions(kind.seed)).toBeDefined()
        }
    })

    it('is what the presentation adapter serves', () => {
        expect(algorandAccountPresentation.keyKindOptions).toBe(
            algorandKeyKindOptions,
        )
    })
})

describe('keyKindOptionI18nKeys', () => {
    it("lists every key the kinds' recover, create and import options name", () => {
        expect(keyKindOptionI18nKeys()).toEqual([
            'onboarding.import_options.hd_wallet.title',
            'onboarding.import_options.hd_wallet.chip',
            'onboarding.import_options.hd_wallet.description',
            'onboarding.import_options.mnemonic_info',
            'onboarding.import_options.algo25.title',
            'onboarding.import_options.algo25.chip',
            'onboarding.import_options.algo25.description',
            'onboarding.import_options.algo25.mnemonic_info',
            'onboarding.add_account.create_algo25_option_title',
            'onboarding.add_account.create_algo25_option_description',
            'onboarding.add_account.quantum_account_option_title',
            'onboarding.add_account.quantum_account_option_description',
            'onboarding.add_account.quantum_creating_title',
            'onboarding.add_account.quantum_account_option_badge',
            'onboarding.add_account.quantum_account_option_learn_more',
            'onboarding.import_account_options.quantum_title',
            'onboarding.import_account_options.quantum_description',
        ])
    })
})
