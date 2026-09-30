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
import { describe, expect, it } from 'vitest'
import { mnemonicToSeed } from '@scure/bip39'
import { bytesToHex } from '@noble/hashes/utils.js'
import {
    BIP32DerivationType,
    XHDWalletAPI,
    fromSeed,
} from '@algorandfoundation/xhd-wallet-api'
import type {
    ChainKeyStore,
    KeyDerivationRequest,
} from '@perawallet/wallet-core-chain-contract'
import { SIGNING_ACCESS_DOMAIN } from '@perawallet/wallet-core-kms'
import { algorandAccountsAdapter } from '../adapter'
import { algorandHdDerivationRequest } from '../hd-derivation'
import { algorandKeyDerivation } from '../key-derivation'

const TEST_MNEMONIC =
    'champion say kitchen sock defense example mesh body sample artwork warfare canvas item recall cheese total floor cycle such asthma okay immense lake street'

const HARDENED = 0x80000000
const SEED_ID = 'seed-1'
const MAINNET = { scheme: 'ed25519', networkId: 'mainnet' } as const

const parsePath = (path: string): number[] =>
    path
        .split('/')
        .slice(1)
        .map(part =>
            part.endsWith("'") ? parseInt(part, 10) + HARDENED : Number(part),
        )

const realCryptoKeyStore = async () => {
    const root = fromSeed(await mnemonicToSeed(TEST_MNEMONIC))
    const api = new XHDWalletAPI()
    const requests: { request: KeyDerivationRequest; domain: string }[] = []
    const kms: ChainKeyStore = {
        deriveFromSeed: async (_seed, request, domain) => {
            requests.push({ request, domain })
            const type =
                request.params?.mode === 'standard'
                    ? BIP32DerivationType.Khovratovich
                    : BIP32DerivationType.Peikert
            const publicKey = (
                await api.deriveKey(root, parsePath(request.path), false, type)
            ).subarray(0, 32)
            return { keyPairId: request.id, publicKey }
        },
        importRawKey: () => Promise.reject(new Error('not used')),
        sign: () => Promise.reject(new Error('not used')),
    }
    return { kms, requests }
}

const CASES = [
    {
        account: 0,
        keyIndex: 0,
        keyPairId: 'seed-1-acc0-idx0-dt9',
        publicKey:
            '8bf7da4540255fe78376424c330365ca9b5ff89fc6a197913c98d75fea7bd783',
        address: 'RP35URKAEVP6PA3WIJGDGA3FZKNV76E7Y2QZPEJ4TDLV72T326B3IOFX7A',
    },
    {
        account: 0,
        keyIndex: 1,
        keyPairId: 'seed-1-acc0-idx1-dt9',
        publicKey:
            '08c3c5ad9b3510f58595742feb58681e66897bf482c9a586a4a5a68ea833efd2',
        address: 'BDB4LLM3GUIPLBMVOQX6WWDIDZTIS67UQLE2LBVEUWTI5KBT57JNVI5QKU',
    },
    {
        account: 1,
        keyIndex: 0,
        keyPairId: 'seed-1-acc1-idx0-dt9',
        publicKey:
            'fadd6fca0c8ef4742039a8d4890ec1e329381ee25f16e28089c8da187dffecaa',
        address: '7LOW7SQMR32HIIBZVDKISDWB4MUTQHXCL4LOFAEJZDNBQ7P75SVJXI5YEI',
    },
    {
        account: 2,
        keyIndex: 5,
        keyPairId: 'seed-1-acc2-idx5-dt9',
        publicKey:
            '918abfada0c9013baa2f7cb69bf386e761d90dce3dffbdf8f1acdc2a708a2d50',
        address: 'SGFL7LNAZEATXKRPPS3JX44G45Q5SDOOHX7336HRVTOCU4EKFVICEKDZOA',
    },
]

describe('algorandKeyDerivation equivalence with the hook-based derivation', () => {
    it.each(CASES)(
        'derives $account/$keyIndex to the same request, id, key and address',
        async ({ account, keyIndex, keyPairId, publicKey, address }) => {
            const { kms, requests } = await realCryptoKeyStore()

            const derived = await algorandKeyDerivation.deriveAccount(
                kms,
                SEED_ID,
                account,
                keyIndex,
                MAINNET,
            )

            expect(requests).toEqual([
                {
                    request: algorandHdDerivationRequest(
                        SEED_ID,
                        account,
                        keyIndex,
                        BIP32DerivationType.Peikert,
                    ),
                    domain: SIGNING_ACCESS_DOMAIN,
                },
            ])
            expect(derived.keyPairId).toBe(keyPairId)
            expect(bytesToHex(derived.publicKey)).toBe(publicKey)
            expect(derived.address).toBe(address)
            expect(
                algorandAccountsAdapter.hdKeyPairId(SEED_ID, {
                    account,
                    keyIndex,
                    derivationType: BIP32DerivationType.Peikert,
                }),
            ).toBe(derived.keyPairId)
        },
    )
})
