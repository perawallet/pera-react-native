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

import { mnemonicWordsToIndices } from '@perawallet/wallet-core-kms'

// Known-good test vectors for the onboarding flows. Both mnemonics and the
// addresses they derive to are pinned by the integration tests in
// packages/kms/src/crypto/__tests__/{algo25,hdwallet}-integration.test.ts —
// keep these in sync with that source of truth.

// 24-word HD wallet seed → m/44'/283'/0'/0/0 with Peikert derivation.
export const HD_TEST_MNEMONIC_24 =
    'champion say kitchen sock defense example mesh body sample artwork warfare canvas item recall cheese total floor cycle such asthma okay immense lake street'

export const HD_TEST_MNEMONIC_24_WORDS = HD_TEST_MNEMONIC_24.split(' ')

export const HD_TEST_MNEMONIC_24_INDICES = mnemonicWordsToIndices(
    HD_TEST_MNEMONIC_24_WORDS,
)!

export const HD_TEST_ADDRESS =
    'RP35URKAEVP6PA3WIJGDGA3FZKNV76E7Y2QZPEJ4TDLV72T326B3IOFX7A'

// Standard 25-word Algorand mnemonic.
export const ALGO25_TEST_MNEMONIC =
    'evoke unique jaguar rapid silent sister kingdom farm anger brother begin fluid brave sister mixture wedding suffer spin spatial combine ginger neutral lunch absorb upset'

export const ALGO25_TEST_MNEMONIC_WORDS = ALGO25_TEST_MNEMONIC.split(' ')

export const ALGO25_TEST_MNEMONIC_INDICES = mnemonicWordsToIndices(
    ALGO25_TEST_MNEMONIC_WORDS,
)!

export const ALGO25_TEST_ADDRESS =
    'T2A7FPKQ3YON2JT5A5CSN4JWNDMUGJY6WX4H6HEH2UPKWSPSPBG5O7X4UM'

/** Distinct from {@link ALGO25_TEST_ADDRESS} / {@link HD_TEST_ADDRESS}; valid non-zero multisig placeholder for integration tests. (algosdk v3 rejects the zero address as a rekeyTo target.) */
export const MULTISIG_REKEY_INTEGRATION_ADDRESS =
    'QLWDYKFO2EHE43ZCZVKCWNEBQ5M5L5BPW5VSCRB3OML5YEBBLWFL3BRTEI'

// Real BIP39 mnemonic words but in an order that fails BIP39 checksum
// validation. Use to assert the import flow surfaces an error toast on
// invalid input.
export const INVALID_HD_MNEMONIC_24_WORDS = Array.from(
    { length: 24 },
    () => 'abandon',
)

// 25 valid words from the Algorand wordlist that combined fail Algo25
// checksum validation.
export const INVALID_ALGO25_MNEMONIC_WORDS = Array.from(
    { length: 25 },
    () => 'abandon',
)

// A throwaway Algorand address used as a rekey target in flow tests.
// The exact value doesn't matter — flows treat the rekey list as opaque
// once it's returned by the indexer mock.
export const REKEY_TARGET_ADDRESS =
    'CBLWUBRWCWNKZ2Y2Q5HFKN7XISNBVAN47422MZOKH5OGCZ3H5JYLTDPLOA'

// Compute the Algorand address derived from `HD_TEST_MNEMONIC_24` at the
// supplied BIP44 indexes (using Peikert's BIP32-Ed25519 amendment, which
// matches production). Useful for tests that mock fast-lookup to surface
// "active" derivations beyond the master (0,0).
export const deriveTestHDAddress = async (
    account: number,
    keyIndex: number,
): Promise<string> => {
    const [bip39, xhd, algosdk] = await Promise.all([
        import('@scure/bip39'),
        import('@algorandfoundation/xhd-wallet-api'),
        import('algosdk'),
    ])
    const seed = await bip39.mnemonicToSeed(HD_TEST_MNEMONIC_24)
    const rootKey = xhd.fromSeed(Buffer.from(seed))
    const api = new xhd.XHDWalletAPI()
    const publicKey = await api.keyGen(
        rootKey,
        xhd.KeyContext.Address,
        account,
        keyIndex,
        xhd.BIP32DerivationType.Peikert,
    )
    return algosdk.encodeAddress(publicKey)
}
