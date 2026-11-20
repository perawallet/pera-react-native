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
// packages/kms/src/crypto/__tests__/{algo25,hdwallet}-integration.spec.ts —
// keep these in sync with that source of truth.

// 24-word HD wallet seed → m/44'/283'/0'/0/0 with Peikert derivation.
export const HD_TEST_MNEMONIC_24 =
    'champion say kitchen sock defense example mesh body sample artwork warfare canvas item recall cheese total floor cycle such asthma okay immense lake street'

export const HD_TEST_MNEMONIC_24_WORDS = HD_TEST_MNEMONIC_24.split(' ')

export const HD_TEST_MNEMONIC_24_INDICES = mnemonicWordsToIndices(
    HD_TEST_MNEMONIC_24_WORDS,
)!

// A second, unrelated 24-word seed for tests that must tell two wallets apart.
// The standard BIP39 all-ones vector; `mnemonicWordsToIndices` does not verify
// the checksum, but a real vector keeps the derivation honest.
export const HD_TEST_MNEMONIC_24_ALT =
    'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo vote'

export const HD_TEST_MNEMONIC_24_ALT_INDICES = mnemonicWordsToIndices(
    HD_TEST_MNEMONIC_24_ALT.split(' '),
)!

// The BIP39 zero-entropy vector: the 12-word phrase other wallets hand out.
// Its Ethereum accounts at m/44'/60'/0'/0/{0,1} are the first two a standard
// BIP-44 wallet such as MetaMask lists.
export const HD_TEST_MNEMONIC_12 =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

export const HD_TEST_MNEMONIC_12_WORDS = HD_TEST_MNEMONIC_12.split(' ')

export const HD_TEST_MNEMONIC_12_INDICES = mnemonicWordsToIndices(
    HD_TEST_MNEMONIC_12_WORDS,
)!

// A 12-word phrase with no repeated word, so a swap of two positions changes it.
// The first BIP39 reference vector with 16 bytes of non-zero entropy.
export const HD_TEST_MNEMONIC_12_DISTINCT =
    'ozone drill grab fiber curtain grace pudding thank cruise elder eight picnic'

export const HD_TEST_MNEMONIC_12_DISTINCT_WORDS =
    HD_TEST_MNEMONIC_12_DISTINCT.split(' ')

export const HD_12_ETHEREUM_ADDRESS_0 =
    '0x9858EfFD232B4033E47d90003D41EC34EcaEda94'

export const HD_12_ETHEREUM_ADDRESS_1 =
    '0x6Fac4D18c912343BF86fa7049364Dd4E424Ab9C0'

// 12 valid wordlist words whose checksum fails.
export const INVALID_HD_MNEMONIC_12_WORDS = Array.from(
    { length: 12 },
    () => 'abandon',
)

export const HD_TEST_ADDRESS =
    'RP35URKAEVP6PA3WIJGDGA3FZKNV76E7Y2QZPEJ4TDLV72T326B3IOFX7A'

// The same seed's next two Algorand addresses at account 0.
export const HD_TEST_ADDRESS_1 =
    'BDB4LLM3GUIPLBMVOQX6WWDIDZTIS67UQLE2LBVEUWTI5KBT57JNVI5QKU'
export const HD_TEST_ADDRESS_2 =
    'SE3DEKH5K3WJX4ULS4UXUSSUOSAPNQNLTCULWWA2LLYAFFXJXCR3XXQ27Y'

// Ethereum at m/44'/60'/{0,2}'/0/0 for the 24-word seed above.
export const HD_24_ETHEREUM_ADDRESS_0 =
    '0x60e94244Cb2053009e5a365D247A091D35BC6EbA'
export const HD_24_ETHEREUM_ACCOUNT_2_ADDRESS_0 =
    '0xfEC5b1B05abE7c49DC8C6E947d1C775C9C69755C'

// Ethereum at m/44'/60'/0'/0/0 through /24 for the 24-word seed above: past
// the wallet walk's key index limit of 20.
export const HD_24_ETHEREUM_ACCOUNT_0_ADDRESSES = [
    '0x60e94244Cb2053009e5a365D247A091D35BC6EbA',
    '0xa759af30D90e7620c25823Dec4b4F59224f8c10a',
    '0x90E6F7C6aBF435A09a3C6e376E65479E8777D944',
    '0xea396709643577B4A07BFA9631Ba448499b72550',
    '0x3DB14C0D720C63d1071db7aC6f174B05BB5A8613',
    '0x7E23E9717eB7a2936C8f961f493c01Fea07Ec033',
    '0xC81b1bc900a2F297Ba7fF09FDe7B63125F06c44F',
    '0x3c6A2147789858769A90c9e845a1f4b577d7cb20',
    '0xeC327187604724d6E65FfbaB4aeCD0694fc1035b',
    '0xDCaAd7D400E535FabfF3b5b8E432Bd4b6c0b29B1',
    '0x77737DFe6BF0aE6e0e232cf8633981c7883C790F',
    '0x69b45eF5DDbCF3D5104d853A54C866DaE08D55e8',
    '0x4Cc6CDCF36cBaE71Bf4C8618A8198A0ac476af50',
    '0x990Fc16648b7d8cc509406D5D2e580fF1E2D8769',
    '0x8b8c3F271E0e0Cb19bad65bbe5AF5d77A0C9cAB3',
    '0xBC61deA91815FCA633399926326c5ABe85f8D132',
    '0x5986c7F2Cd142030294B80f1f446B63cd4eB8A1C',
    '0xAa6B09c3f2F63Dfc02aa59A39943B193a40065eb',
    '0xF96Da5C42e9681Ec5091656E8D11d556cD1c3A23',
    '0x40d60ECb7Ce4Cbc2B6A3985cF465a1AbF9ac31b0',
    '0x4Cc4155B9EcBac41adAA5c4B4b221E00501B59b0',
    '0x29af4DA9cF7AD28ab2a906df8FE7a5604Df59d58',
    '0xB40a31F1D8Ae58155b833c4e68b3299c147B416A',
    '0xf83A19b18ad18c2976a1F3a3442F0122b1b9b807',
    '0xF858a601c210cF0B127b0601e4ced045e66F2353',
]

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

// Compute the Algorand address derived from `mnemonic` (default
// `HD_TEST_MNEMONIC_24`) at the supplied BIP44 indexes (using Peikert's
// BIP32-Ed25519 amendment, which matches production). Useful for tests that mock fast-lookup to surface
// "active" derivations beyond the master (0,0).
export const deriveTestHDAddress = async (
    account: number,
    keyIndex: number,
    mnemonic: string = HD_TEST_MNEMONIC_24,
): Promise<string> => {
    const [bip39, xhd, algosdk] = await Promise.all([
        import('@scure/bip39'),
        import('@algorandfoundation/xhd-wallet-api'),
        import('algosdk'),
    ])
    const seed = await bip39.mnemonicToSeed(mnemonic)
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
