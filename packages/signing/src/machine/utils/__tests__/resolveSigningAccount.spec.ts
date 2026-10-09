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

import { beforeEach, describe, it, expect } from 'vitest'
import { seedAuthority } from '../../../__tests__/registerAlgorandAccounts'
import {
    DelegationTargetNotFoundError,
    useAccountChainStateStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { ChainAdapterNotRegisteredError } from '@perawallet/wallet-core-chain-contract'
import type { SourceMetadata } from '../../../pipeline/types'
import { resolveSigningAccount } from '../resolveSigningAccount'

const PARTICIPANT =
    'PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP'
const AUTH = 'UUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUU'

const rekeyedSigner: WalletAccount = {
    custody: { kind: 'local', seed: null },
    address: PARTICIPANT,
    keyPairId: 'key-participant',
} as unknown as WalletAccount

const authAccount: WalletAccount = {
    custody: { kind: 'local', seed: null },
    address: AUTH,
    keyPairId: 'key-auth',
} as unknown as WalletAccount

/** The shape: rekeyed on chain, no local key of its own. */
const keylessRekeyedSigner: WalletAccount = {
    custody: { kind: 'watch' },
    address: PARTICIPANT,
} as unknown as WalletAccount

const plainSigner: WalletAccount = {
    custody: { kind: 'local', seed: null },
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
    beforeEach(() => {
        useAccountChainStateStore.getState().resetState()
    })

    it('returns the signer itself for multisig-cosign even when the signer is rekeyed', () => {
        seedAuthority(PARTICIPANT, AUTH)
        const result = resolveSigningAccount(
            rekeyedSigner,
            cosignSource,
            'transactions',
            [rekeyedSigner, authAccount],
            'algorand',
        )
        expect(result.address).toBe(PARTICIPANT)
    })

    it('follows rekey to the auth account for transaction signing on non-cosign sources', () => {
        seedAuthority(PARTICIPANT, AUTH)
        const result = resolveSigningAccount(
            rekeyedSigner,
            localSource,
            'transactions',
            [rekeyedSigner, authAccount],
            'algorand',
        )
        expect(result.address).toBe(AUTH)
    })

    it('returns the signer itself when not rekeyed (regardless of source)', () => {
        const result = resolveSigningAccount(
            plainSigner,
            localSource,
            'transactions',
            [plainSigner],
            'algorand',
        )
        expect(result.address).toBe(PARTICIPANT)
    })

    it('throws DelegationTargetNotFoundError on transactions when the rekey target is missing', () => {
        seedAuthority(PARTICIPANT, AUTH)
        expect(() =>
            resolveSigningAccount(
                rekeyedSigner,
                localSource,
                'transactions',
                [rekeyedSigner],
                'algorand',
            ),
        ).toThrow(DelegationTargetNotFoundError)
    })

    it('returns the signer itself for arbitrary-data even when rekeyed', () => {
        seedAuthority(PARTICIPANT, AUTH)
        // ARC-1 verifies against the requested account's own pubkey; the
        // rekey hop must NOT be followed for off-chain data.
        const result = resolveSigningAccount(
            rekeyedSigner,
            localSource,
            'arbitrary-data',
            [rekeyedSigner, authAccount],
            'algorand',
        )
        expect(result.address).toBe(PARTICIPANT)
    })

    it('returns the keyless signer itself for auth-data even when its auth account holds a key', () => {
        seedAuthority(PARTICIPANT, AUTH)
        // An ARC-60 signature verifies against `signer`'s own pubkey, so a
        // signature from the auth key would fail every verifier. The signer
        // is returned as-is and the leaf signer refuses it (no key).
        const result = resolveSigningAccount(
            keylessRekeyedSigner,
            localSource,
            'auth-data',
            [keylessRekeyedSigner, authAccount],
            'algorand',
        )
        expect(result.address).toBe(PARTICIPANT)
    })

    it('returns the rekeyed signer itself for auth-data when it holds its own key', () => {
        seedAuthority(PARTICIPANT, AUTH)
        const result = resolveSigningAccount(
            rekeyedSigner,
            localSource,
            'auth-data',
            [rekeyedSigner, authAccount],
            'algorand',
        )
        expect(result.address).toBe(PARTICIPANT)
    })

    it('never consults the rekey target for auth-data, so a missing target does not throw', () => {
        seedAuthority(PARTICIPANT, AUTH)
        const result = resolveSigningAccount(
            keylessRekeyedSigner,
            localSource,
            'auth-data',
            [keylessRekeyedSigner],
            'algorand',
        )
        expect(result.address).toBe(PARTICIPANT)
    })

    it('returns the signer itself for auth-data when not rekeyed', () => {
        const result = resolveSigningAccount(
            plainSigner,
            localSource,
            'auth-data',
            [plainSigner],
            'algorand',
        )
        expect(result.address).toBe(PARTICIPANT)
    })

    it("follows the rekey hop through the given chain's rules, never Algorand's", () => {
        expect(() =>
            resolveSigningAccount(
                rekeyedSigner,
                localSource,
                'transactions',
                [rekeyedSigner, authAccount],
                'ethereum',
            ),
        ).toThrow(ChainAdapterNotRegisteredError)
    })
})
