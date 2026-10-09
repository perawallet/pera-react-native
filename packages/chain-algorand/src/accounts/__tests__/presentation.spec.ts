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

import { beforeAll, describe, expect, it } from 'vitest'
import {
    accountsChainAdapters,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { BackupAccountType } from '@perawallet/wallet-core-backup'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { config } from '@perawallet/wallet-core-config'
import {
    algo25Account,
    hardwareAccount,
    hdAccount,
    multisigAccount,
    quantumAccount,
    watchAccount,
} from '../../__tests__/algorandAccounts'
import { algorandAccountsAdapter } from '../adapter'
import {
    accountPresentationI18nKeys,
    algorandAccountPresentation,
} from '../presentation'

beforeAll(() => {
    accountsChainAdapters.reset()
    accountsChainAdapters.register(algorandAccountsAdapter)
})

const SCOPE: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }

const { transitionLabel } = algorandAccountPresentation
const describeAccount = (
    account: WalletAccount,
    accounts: readonly WalletAccount[],
) => algorandAccountPresentation.describe(account, accounts, SCOPE)

const participant = algo25Account('P1')
const signableMultisig = multisigAccount('MS', {
    threshold: 2,
    addresses: ['P1', 'P2'],
})

describe('algorandAccountPresentation.describe', () => {
    it.each([
        [
            'algo25',
            algo25Account('A'),
            {
                labelKey: 'account_info.type_algo25',
                infoTitleKey: 'account_type_info.standard_title',
                infoBodyKey: 'account_type_info.standard_description',
                glyph: 'accounts/glyph/algo25-account',
                supportUrl: config.accountTypeSupportUrl,
            },
        ],
        [
            'hdWallet',
            hdAccount('A'),
            {
                labelKey: 'account_info.type_universal_wallet',
                infoTitleKey: 'account_type_info.hd_wallet_title',
                infoBodyKey: 'account_type_info.hd_wallet_description',
                glyph: 'accounts/glyph/hdwallet-account',
                supportUrl: config.accountTypeSupportUrl,
            },
        ],
        [
            'hardware',
            hardwareAccount('A'),
            {
                labelKey: 'account_info.type_ledger',
                infoTitleKey: 'account_type_info.ledger_title',
                infoBodyKey: 'account_type_info.ledger_description',
                glyph: 'accounts/glyph/ledger-account',
                rekeyedGlyph: 'accounts/glyph/rekeyed-ledger',
                supportUrl: config.ledgerAccountSupportUrl,
            },
        ],
        [
            'multisig',
            signableMultisig,
            {
                labelKey: 'account_info.type_multisig',
                infoTitleKey: 'account_type_info.multisig_title',
                infoBodyKey: 'account_type_info.multisig_description',
                glyph: 'accounts/glyph/multisig-account',
                rekeyedGlyph: 'accounts/glyph/rekeyed-multisig',
                supportUrl: config.multisigSupportUrl,
            },
        ],
        [
            'watch',
            watchAccount('A'),
            {
                labelKey: 'account_info.type_watch',
                infoTitleKey: 'account_type_info.watch_title',
                infoBodyKey: 'account_type_info.watch_description',
                glyph: 'accounts/glyph/watch-account',
                supportUrl: config.accountTypeSupportUrl,
            },
        ],
        [
            'quantum',
            quantumAccount('A'),
            {
                labelKey: 'account_info.type_quantum',
                infoTitleKey: 'account_type_info.quantum_title',
                infoBodyKey: 'account_type_info.quantum_description',
                glyph: 'accounts/glyph/quantum-account',
                supportUrl: config.quantumAccountSupportUrl,
            },
        ],
    ] as const)('describes a %s account', (kind, account, copy) => {
        expect(describeAccount(account, [account, participant])).toEqual({
            kindId: kind,
            analyticsKind: kind,
            ...copy,
        })
    })

    it('describes a multisig with no held participant as a no-auth account', () => {
        const presentation = describeAccount(signableMultisig, [
            signableMultisig,
        ])

        expect(presentation).toMatchObject({
            kindId: 'multisig',
            labelKey: 'account_info.type_no_auth',
            infoTitleKey: 'account_type_info.no_auth_title',
            infoBodyKey: 'account_type_info.multisig_no_auth_description',
            glyph: 'accounts/glyph/multisig-account',
            supportUrl: config.multisigSupportUrl,
        })
    })

    it('describes a multisig without parameters as a no-auth account', () => {
        const legacy = multisigAccount('MS', null)

        expect(describeAccount(legacy, [legacy, participant]).labelKey).toBe(
            'account_info.type_no_auth',
        )
    })

    it('describes the account by its own kind, ignoring rekey', () => {
        const rekeyed = algo25Account('A', { rekeyAddress: 'L' })

        expect(
            describeAccount(rekeyed, [rekeyed, hardwareAccount('L')]).kindId,
        ).toBe('algo25')
    })
})

describe('algorandAccountPresentation.transitionLabel', () => {
    const ledger = hardwareAccount('L')
    const standard = algo25Account('A')
    const hd = hdAccount('H')
    const quantum = quantumAccount('F')

    it.each<[string, WalletAccount, WalletAccount, string, string]>([
        [
            'ledger → ledger',
            hardwareAccount('L2'),
            ledger,
            'account_info.rekey_signer_ledger',
            'account_type_info.rekeyed_ledger_to_ledger_description',
        ],
        [
            'standard → multisig',
            standard,
            signableMultisig,
            'account_info.rekey_signer_shared',
            'account_type_info.rekeyed_shared_description',
        ],
        [
            'ledger → multisig',
            ledger,
            signableMultisig,
            'account_info.rekey_signer_shared',
            'account_type_info.rekeyed_shared_description',
        ],
        [
            'standard → ledger',
            standard,
            ledger,
            'account_info.rekey_signer_ledger',
            'account_type_info.rekeyed_ledger_description',
        ],
        [
            'standard → quantum',
            standard,
            quantum,
            'account_info.rekey_signer_quantum',
            'account_type_info.rekeyed_quantum_description',
        ],
        [
            'ledger → standard',
            ledger,
            standard,
            'account_info.rekey_signer_standard',
            'account_type_info.rekeyed_standard_description',
        ],
        [
            'standard → hd',
            standard,
            hd,
            'account_info.rekey_signer_standard',
            'account_type_info.rekeyed_standard_description',
        ],
        [
            'standard → watch',
            standard,
            watchAccount('W'),
            'account_info.rekey_signer_watch',
            'account_type_info.rekeyed_standard_description',
        ],
    ])('labels %s', (_, from, to, signerKey, descriptionKey) => {
        expect(transitionLabel(from, to)).toMatchObject({
            labelKey: 'account_info.type_rekeyed_signer',
            signerKey,
            descriptionKey,
        })
    })

    it("links the signer kind's support page", () => {
        expect(transitionLabel(standard, ledger).supportUrl).toBe(
            config.ledgerAccountSupportUrl,
        )
        expect(transitionLabel(standard, quantum).supportUrl).toBe(
            config.quantumAccountSupportUrl,
        )
    })
})

describe('accountPresentationI18nKeys', () => {
    it('lists every key the presentation emits', () => {
        const keys = new Set(accountPresentationI18nKeys())
        const accounts = [
            algo25Account('A'),
            hdAccount('H'),
            hardwareAccount('L'),
            signableMultisig,
            watchAccount('W'),
            quantumAccount('F'),
        ]

        for (const account of accounts) {
            for (const held of [[account, participant], [account]]) {
                const { labelKey, infoTitleKey, infoBodyKey } = describeAccount(
                    account,
                    held,
                )
                expect(keys).toContain(labelKey)
                expect(keys).toContain(infoTitleKey)
                expect(keys).toContain(infoBodyKey)
            }
            for (const to of accounts) {
                const label = transitionLabel(account, to)
                expect(keys).toContain(label.labelKey)
                expect(keys).toContain(label.signerKey)
                expect(keys).toContain(label.descriptionKey)
            }
        }
    })
})

describe('kindGlyph', () => {
    it.each([
        algo25Account('A'),
        hdAccount('A'),
        hardwareAccount('A'),
        multisigAccount('A', null),
        watchAccount('A'),
        quantumAccount('A'),
    ])('matches the glyph describe gives the same kind', account => {
        const described = describeAccount(account, [account])

        expect(algorandAccountPresentation.kindGlyph(described.kindId)).toBe(
            described.glyph,
        )
    })

    // A backup-only row passes the item's wire kind as the kind id.
    it.each(
        Object.values(BackupAccountType).filter(
            type => type !== BackupAccountType.hdSeed,
        ),
    )('names a glyph for the %s backup item kind', type => {
        expect(algorandAccountPresentation.kindGlyph(type)).toBeDefined()
    })

    it('names none for an id it does not describe', () => {
        expect(algorandAccountPresentation.kindGlyph('hdSeed')).toBeUndefined()
        expect(
            algorandAccountPresentation.kindGlyph('toString'),
        ).toBeUndefined()
    })
})
