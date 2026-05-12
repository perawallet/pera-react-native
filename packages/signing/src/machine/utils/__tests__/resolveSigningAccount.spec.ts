/*
 Copyright 2022-2025 Pera Wallet, LDA
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
        const result = resolveSigningAccount(rekeyedSigner, cosignSource, [
            rekeyedSigner,
            authAccount,
        ])
        expect(result.address).toBe(PARTICIPANT)
    })

    it('follows rekey to the auth account for non-cosign sources', () => {
        const result = resolveSigningAccount(rekeyedSigner, localSource, [
            rekeyedSigner,
            authAccount,
        ])
        expect(result.address).toBe(AUTH)
    })

    it('returns the signer itself when not rekeyed (regardless of source)', () => {
        const result = resolveSigningAccount(plainSigner, localSource, [
            plainSigner,
        ])
        expect(result.address).toBe(PARTICIPANT)
    })

    it('throws RekeyTargetNotFoundError on non-cosign source when the rekey target is missing', () => {
        expect(() =>
            resolveSigningAccount(rekeyedSigner, localSource, [rekeyedSigner]),
        ).toThrow(RekeyTargetNotFoundError)
    })
})
