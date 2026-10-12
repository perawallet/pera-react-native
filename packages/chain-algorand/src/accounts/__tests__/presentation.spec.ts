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
    accountKindId,
    accountsChainAdapters,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { BackupAccountType } from '@perawallet/wallet-core-backup'
import {
    AlgorandBackupKinds,
    algorandBackupKindIdOf,
} from '../../backup/serialize-account'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { config } from '@perawallet/wallet-core-config'
import {
    standaloneAccount,
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

const { kindIdOf } = algorandAccountsAdapter

// As `useAccountPresentation` asks: by the account's kind id and whether a
// held account signs for it.
const describeAccount = (
    account: WalletAccount,
    accounts: readonly WalletAccount[],
) => {
    const canSign =
        algorandAccountsAdapter.resolveSigner(account, [...accounts], SCOPE)
            .kind === 'ok'
    const described = algorandAccountPresentation.describe(kindIdOf(account), {
        canSign,
    })
    if (!described) throw new Error('undescribed kind')
    return described
}

const transitionLabel = (from: WalletAccount, to: WalletAccount) => {
    const label = algorandAccountPresentation.transitionLabel!(
        kindIdOf(from),
        kindIdOf(to),
    )
    if (!label) throw new Error('unlabelled transition')
    return label
}

const participant = standaloneAccount('P1')
const signableMultisig = multisigAccount('MS', {
    threshold: 2,
    addresses: ['P1', 'P2'],
})

describe('algorandAccountPresentation.describe', () => {
    it.each([
        [
            'standalone',
            standaloneAccount('A'),
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
                delegatedGlyph: 'accounts/glyph/rekeyed-ledger',
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
                delegatedGlyph: 'accounts/glyph/rekeyed-multisig',
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
        expect(kindIdOf(account)).toBe(kind)
        expect(describeAccount(account, [account, participant])).toEqual(copy)
    })

    it('describes a multisig with no held participant as a no-auth account', () => {
        const presentation = describeAccount(signableMultisig, [
            signableMultisig,
        ])

        expect(presentation).toMatchObject({
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

    it('names the account by its own kind, ignoring rekey', () => {
        const rekeyed = standaloneAccount('A', { authorityAddress: 'L' })

        expect(kindIdOf(rekeyed)).toBe('standalone')
    })

    it('describes no kind id it does not name', () => {
        for (const kindId of ['algo25', 'hdSeed', 'toString']) {
            expect(
                algorandAccountPresentation.describe(accountKindId(kindId), {
                    canSign: true,
                }),
            ).toBeUndefined()
        }
    })
})

describe('algorandAccountPresentation.transitionLabel', () => {
    const ledger = hardwareAccount('L')
    const standard = standaloneAccount('A')
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
            standaloneAccount('A'),
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

describe('glyphs', () => {
    it.each([
        standaloneAccount('A'),
        hdAccount('A'),
        hardwareAccount('A'),
        multisigAccount('A', null),
        watchAccount('A'),
        quantumAccount('A'),
    ])('are the same whether or not the account can sign', account => {
        const kindId = kindIdOf(account)

        expect(
            algorandAccountPresentation.describe(kindId, { canSign: false })
                ?.glyph,
        ).toBe(
            algorandAccountPresentation.describe(kindId, { canSign: true })
                ?.glyph,
        )
    })

    // A backup-only row shows the kind the backup adapter reads off the item.
    it.each([
        ...Object.values(AlgorandBackupKinds),
        ...Object.values(BackupAccountType).filter(
            type => type !== BackupAccountType.hdSeed,
        ),
    ])('include one for the %s backup item kind', type => {
        const kindId = algorandBackupKindIdOf(type)

        expect(kindId).toBeDefined()
        expect(
            algorandAccountPresentation.describe(kindId!, { canSign: true })
                ?.glyph,
        ).toBeDefined()
    })
})
