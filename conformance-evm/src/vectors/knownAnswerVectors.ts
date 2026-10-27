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

import type { Address, Hex } from 'viem'

// Anvil's documented default accounts (https://book.getfoundry.sh/anvil/):
// mnemonic "test test ... junk", path m/44'/60'/0'/0/<index>.
export const ANVIL_DEV_MNEMONIC_VECTOR = {
    mnemonic: 'test test test test test test test test test test test junk',
    addresses: [
        '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    ],
    privateKeys: [
        '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
        '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
    ],
} as const satisfies {
    mnemonic: string
    addresses: readonly Address[]
    privateKeys: readonly Hex[]
}

// The mixed-case, all-caps and all-lowercase checksummed addresses in the
// EIP-55 text (ERC-55, "Test Cases").
export const EIP55_VECTORS: readonly string[] = [
    '0x52908400098527886E0F7030069857D2E4169EE7',
    '0x8617E340B3D01FA5F11F306F4090FD50E238070D',
    '0xde709f2102306220921060314715629080e2fb77',
    '0x27b1fdb04752bbc536007a920d24acb045561c26',
    '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
    '0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB',
    '0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb',
]

// The worked example in the EIP-155 text ("Example"). Mainnet chain id 1 is
// used only to check cast's encoding; this transaction is never sent to a node.
export const EIP155_SIGNING_VECTOR = {
    privateKey:
        '0x4646464646464646464646464646464646464646464646464646464646464646',
    chainId: 1,
    nonce: 9,
    gasPrice: 20_000_000_000n,
    gas: 21_000n,
    to: '0x3535353535353535353535353535353535353535',
    value: 1_000_000_000_000_000_000n,
    signedRlp:
        '0xf86c098504a817c800825208943535353535353535353535353535353535353535880de0b6b3a76400008025a028ef61340bd939bc2195fe537567866003e1a15d3c71ff63e1590620aa636276a067cbe9d8997f761aecb703304b3800ccf555c9f3dc64214b297fb1966a3b6d83',
} as const satisfies {
    privateKey: Hex
    chainId: number
    nonce: number
    gasPrice: bigint
    gas: bigint
    to: Address
    value: bigint
    signedRlp: Hex
}
