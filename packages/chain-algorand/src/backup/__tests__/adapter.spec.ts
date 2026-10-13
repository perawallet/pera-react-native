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
import type { BackupItemKind } from '@perawallet/wallet-core-backup'
import { createFakeChainKeyStore } from '@perawallet/wallet-core-chain-contract/testing'
import { encodeAlgorandAddress } from '../../blockchain'
import { SIGNING_ACCESS_DOMAIN } from '@perawallet/wallet-core-kms'
import { HdDerivationTypeUnsupportedError } from '../../accounts/errors'
import { hdDerivedKeyId } from '../../accounts/hd-derivation'
import { algorandAccountPresentation } from '../../accounts/presentation'
import { DerivationTypes } from '../../accounts/vocabulary'
import { algorandBackupAdapter } from '../adapter'

const recordingKms = () => {
    const kms = createFakeChainKeyStore()
    const domains: string[] = []
    return {
        kms: {
            ...kms,
            deriveFromSeed: (
                ...args: Parameters<typeof kms.deriveFromSeed>
            ) => {
                domains.push(args[2])
                return kms.deriveFromSeed(...args)
            },
        },
        derivations: kms.derivations,
        domains,
    }
}

describe('algorandBackupAdapter.deriveHdAccount', () => {
    it('derives the stored coordinates under the signing domain', async () => {
        const { kms, derivations, domains } = recordingKms()
        const derivationType = DerivationTypes.Peikert

        const derived = await algorandBackupAdapter.deriveHdAccount(
            kms,
            'seed-1',
            { account: 2, keyIndex: 5, derivationType },
        )

        expect(derivations[0]).toMatchObject({
            scheme: 'ed25519',
            path: "m/44'/283'/2'/0/5",
            id: hdDerivedKeyId('seed-1', 2, 5, derivationType),
        })
        expect(domains).toEqual([SIGNING_ACCESS_DOMAIN])
        expect(derived.keyPairId).toBe(
            hdDerivedKeyId('seed-1', 2, 5, derivationType),
        )
        expect(derived.address).toBe(encodeAlgorandAddress(derived.publicKey))
    })

    it('refuses a derivation type other than Peikert and derives nothing', async () => {
        const { kms, derivations } = recordingKms()

        await expect(
            algorandBackupAdapter.deriveHdAccount(kms, 'seed-1', {
                account: 0,
                keyIndex: 0,
                derivationType: DerivationTypes.Khovratovich,
            }),
        ).rejects.toBeInstanceOf(HdDerivationTypeUnsupportedError)
        expect(derivations).toHaveLength(0)
    })

    it('derives Peikert when the payload names no derivation type', async () => {
        const { kms, derivations } = recordingKms()

        await algorandBackupAdapter.deriveHdAccount(kms, 'seed-1', {
            account: 1,
            keyIndex: 2,
        })

        expect(derivations[0]).toMatchObject({
            id: hdDerivedKeyId('seed-1', 1, 2, DerivationTypes.Peikert),
        })
    })
})

describe('algorandBackupAdapter.seedReference', () => {
    it('is the account 0 / key index 0 Peikert address', async () => {
        const { kms, derivations } = recordingKms()

        const reference = await algorandBackupAdapter.seedReference(
            kms,
            'seed-1',
        )

        expect(derivations).toHaveLength(1)
        expect(derivations[0]).toMatchObject({
            path: "m/44'/283'/0'/0/0",
            id: hdDerivedKeyId('seed-1', 0, 0, DerivationTypes.Peikert),
        })
        const peikert = await algorandBackupAdapter.deriveHdAccount(
            kms,
            'seed-1',
            {
                account: 0,
                keyIndex: 0,
                derivationType: DerivationTypes.Peikert,
            },
        )
        expect(reference).toBe(peikert.address)
    })
})

describe('algorandBackupAdapter.kindIdOf', () => {
    // An address held only in a backup shows the glyph its kind has as a held account.
    it.each([
        ['algo25', 'accounts/glyph/algo25-account'],
        ['hdWallet', 'accounts/glyph/hdwallet-account'],
        ['hardware', 'accounts/glyph/ledger-account'],
        ['watch', 'accounts/glyph/watch-account'],
        ['multisig', 'accounts/glyph/multisig-account'],
        ['quantum', 'accounts/glyph/quantum-account'],
    ] as const)('decodes a %s item to the kind showing %s', (type, glyph) => {
        const kindId = algorandBackupAdapter.kindIdOf(type as BackupItemKind)

        expect(
            kindId &&
                algorandAccountPresentation.describe(kindId, { canSign: true })
                    ?.glyph,
        ).toBe(glyph)
    })

    it('has no kind for a bare seed item', () => {
        expect(algorandBackupAdapter.kindIdOf('hdSeed')).toBeUndefined()
    })

    // A wire type is untrusted, so a prototype key must not read as a kind.
    it.each(['fixtureChainAccount', 'constructor', 'toString'])(
        'has no kind for a %s item',
        type => {
            expect(
                algorandBackupAdapter.kindIdOf(type as BackupItemKind),
            ).toBeUndefined()
        },
    )
})
