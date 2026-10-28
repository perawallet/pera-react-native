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
import { algorandKeyKindOptions } from '../key-kind-options'
import { algorandLocalKeyKinds } from '../local-key-kinds'
import { algorandAccountPresentation } from '../presentation'

describe('algorandKeyKindOptions', () => {
    it('offers the HD kind only from the recover chooser, as the suggested kind', () => {
        expect(algorandKeyKindOptions(SeedScheme.Bip39)).toEqual({
            recover: {
                id: 'hd_wallet',
                titleKey: 'onboarding.import_options.hd_wallet.title',
                descriptionKey:
                    'onboarding.import_options.hd_wallet.description',
                isSuggested: true,
                order: 0,
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
                isSuggested: false,
                order: 2,
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

    it('offers the quantum kind as a featured create option and from the recover chooser', () => {
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
            recover: {
                id: 'quantum',
                titleKey: 'onboarding.import_options.quantum.title',
                descriptionKey: 'onboarding.import_options.quantum.description',
                isSuggested: false,
                order: 1,
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
