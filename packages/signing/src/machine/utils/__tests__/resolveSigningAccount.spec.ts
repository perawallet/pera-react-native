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

import { describe, it, expect } from 'vitest'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { RekeyTargetNotFoundError } from '@perawallet/wallet-core-accounts'
import type { SourceMetadata } from '../../../pipeline/types'
import { resolveSigningAccount } from '../resolveSigningAccount'

const PARTICIPANT =
    'PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP'
const AUTH = 'UUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUU'

const rekeyedSigner: WalletAccount = {
    type: 'algo25',
    address: PARTICIPANT,
    keyPairId: 'key-participant',
    rekeyAddress: AUTH,
} as unknown as WalletAccount

const authAccount: WalletAccount = {
    type: 'algo25',
    address: AUTH,
    keyPairId: 'key-auth',
} as unknown as WalletAccount

/** The PERA-4977 shape: rekeyed on chain, no local key of its own. */
const keylessRekeyedSigner: WalletAccount = {
    type: 'watch',
    address: PARTICIPANT,
    rekeyAddress: AUTH,
} as unknown as WalletAccount

const plainSigner: WalletAccount = {
    type: 'algo25',
    address: PARTICIPANT,
    keyPairId: 'key-participant',
} as unknown as WalletAccount

const cosignSource: SourceMetadata = {
    type: 'multisig-cosign',
    signRequestId: 'sr-1',
    requestId: 'req-1',
}
const localSource: SourceMetadata = { type: 'local' }

describe('resolveSigningAccount', () => {
    it('returns the signer itself for multisig-cosign even when the signer is rekeyed', () => {
        const result = resolveSigningAccount(
            rekeyedSigner,
            cosignSource,
            'transactions',
            [rekeyedSigner, authAccount],
        )
        expect(result.address).toBe(PARTICIPANT)
    })

    it('follows rekey to the auth account for transaction signing on non-cosign sources', () => {
        const result = resolveSigningAccount(
            rekeyedSigner,
            localSource,
            'transactions',
            [rekeyedSigner, authAccount],
        )
        expect(result.address).toBe(AUTH)
    })

    it('returns the signer itself when not rekeyed (regardless of source)', () => {
        const result = resolveSigningAccount(
            plainSigner,
            localSource,
            'transactions',
            [plainSigner],
        )
        expect(result.address).toBe(PARTICIPANT)
    })

    it('throws RekeyTargetNotFoundError on transactions when the rekey target is missing', () => {
        expect(() =>
            resolveSigningAccount(rekeyedSigner, localSource, 'transactions', [
                rekeyedSigner,
            ]),
        ).toThrow(RekeyTargetNotFoundError)
    })

    it('returns the signer itself for arbitrary-data even when rekeyed', () => {
        // ARC-1 verifies against the requested account's own pubkey; the
        // rekey hop must NOT be followed for off-chain data.
        const result = resolveSigningAccount(
            rekeyedSigner,
            localSource,
            'arbitrary-data',
            [rekeyedSigner, authAccount],
        )
        expect(result.address).toBe(PARTICIPANT)
    })

    it('falls back to the auth account for arc60 when the signer holds no key', () => {
        // Unlike ARC-1, the SIWA payload names the authenticated account
        // (`account_address`) separately from the signing key, so the auth
        // account is the correct producer for a keyless rekeyed signer.
        const result = resolveSigningAccount(
            keylessRekeyedSigner,
            localSource,
            'arc60',
            [keylessRekeyedSigner, authAccount],
        )
        expect(result.address).toBe(AUTH)
    })

    it('does not hop for arc60 when the rekeyed signer holds its own key', () => {
        // A dApp that resolved the auth address itself names THAT account as
        // the signer; hopping again off its own chained rekey would sign with
        // a key the authenticated account's auth-addr never designated.
        const result = resolveSigningAccount(
            rekeyedSigner,
            localSource,
            'arc60',
            [rekeyedSigner, authAccount],
        )
        expect(result.address).toBe(PARTICIPANT)
    })

    it('throws RekeyTargetNotFoundError on arc60 when a keyless signer has no rekey target', () => {
        expect(() =>
            resolveSigningAccount(keylessRekeyedSigner, localSource, 'arc60', [
                keylessRekeyedSigner,
            ]),
        ).toThrow(RekeyTargetNotFoundError)
    })

    it('returns the signer itself for arc60 when not rekeyed', () => {
        const result = resolveSigningAccount(
            plainSigner,
            localSource,
            'arc60',
            [plainSigner],
        )
        expect(result.address).toBe(PARTICIPANT)
    })
})
