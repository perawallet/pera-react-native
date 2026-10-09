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

// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateKey } from 'falcon-1024'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import { deriveQuantumAddress } from '../../blockchain'
import { storedQuantumPublicKey } from '../quantum'
import { withStoredQuantumPublicKey } from '../quantumPublicKeyBackfill'

const state = vi.hoisted(() => ({
    resolve: (): unknown => null,
}))

vi.mock('@perawallet/wallet-core-kms', async importOriginal => ({
    ...(await importOriginal<typeof import('@perawallet/wallet-core-kms')>()),
    resolvePQSigningInfo: () => state.resolve(),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getKeystoreStore: () => ({ state: { keys: [] } }),
}))

const { publicKey: PUBLIC_KEY } = generateKey(new Uint8Array(48).fill(4))
const { publicKey: OTHER_KEY } = generateKey(new Uint8Array(48).fill(6))
const ADDRESS = deriveQuantumAddress(PUBLIC_KEY)

const quantum = (native?: unknown): WalletAccount =>
    ({
        custody: { kind: 'local', seed: 'quantum' },
        address: ADDRESS,
        keyPairId: 'kp-quantum',
        chains: {
            algorand: {
                address: ADDRESS,
                keyPairId: 'kp-quantum',
                ...(native ? { native } : {}),
            },
        },
    }) as WalletAccount

const storedNative = (publicKey: Uint8Array) => ({
    family: 'algorand',
    pq: { scheme: 'falcon-1024', publicKey: encodeToBase64(publicKey) },
})

beforeEach(() => {
    state.resolve = () => ({ schemeId: 'falcon1024', publicKey: PUBLIC_KEY })
})

describe('storedQuantumPublicKey', () => {
    it('returns a stored key that derives the account address', () => {
        expect(
            storedQuantumPublicKey(quantum(storedNative(PUBLIC_KEY))),
        ).toEqual(PUBLIC_KEY)
    })

    it('ignores a stored key that derives some other address', () => {
        expect(
            storedQuantumPublicKey(quantum(storedNative(OTHER_KEY))),
        ).toBeNull()
    })
})

describe('withStoredQuantumPublicKey', () => {
    it("stores the keystore's key on a quantum account that lacks one", () => {
        const account = quantum()

        const backfilled = withStoredQuantumPublicKey(account)

        expect(storedQuantumPublicKey(backfilled)).toEqual(PUBLIC_KEY)
        expect(account.chains?.algorand?.native).toBeUndefined()
    })

    it('returns the same record when the key is already stored', () => {
        const account = quantum(storedNative(PUBLIC_KEY))

        expect(withStoredQuantumPublicKey(account)).toBe(account)
    })

    it("returns the same record when the keystore can't describe the key, or it derives another address", () => {
        const account = quantum()
        state.resolve = () => {
            throw new Error('keystore locked')
        }
        expect(withStoredQuantumPublicKey(account)).toBe(account)

        state.resolve = () => ({ schemeId: 'falcon1024', publicKey: OTHER_KEY })
        expect(withStoredQuantumPublicKey(account)).toBe(account)
    })
})
