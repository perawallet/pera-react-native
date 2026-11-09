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

// Shared by the flows that send to an ENS name. Pure data: it imports nothing
// the flows' config mocks could change.

import type { WalletAccount } from '@perawallet/wallet-core-accounts'

export const L1_RPC = 'https://l1.rpc.test/'
export const BASE_RPC = 'https://base.rpc.test/'

// Hardhat accounts #0 to #3, from the public test mnemonic.
export const ETHEREUM_SENDER_ADDRESS =
    '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
export const BASE_SENDER_ADDRESS = '0x90F79bf6EB2c4f870365E785982E1f101E93b906'
export const ALICE_ETHEREUM = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
export const ALICE_BASE = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'

export const ENS_UNIVERSAL_RESOLVER =
    '0xeeeeeeee14d718c2b47d9923deab1335e144eeee'

export const COIN_TYPE_ETHEREUM = 60n
// ENSIP-11: 0x80000000 | 8453
export const COIN_TYPE_BASE = (1n << 31n) | 8453n

export const ETHEREUM_SENDER: WalletAccount = {
    id: 'eth-sender',
    custody: { kind: 'local', seed: null },
    chains: {
        ethereum: { address: ETHEREUM_SENDER_ADDRESS, keyPairId: 'eth-key' },
    },
    name: 'Eth sender',
}

export const BASE_SENDER: WalletAccount = {
    id: 'base-sender',
    custody: { kind: 'local', seed: null },
    chains: { base: { address: BASE_SENDER_ADDRESS, keyPairId: 'base-key' } },
    name: 'Base sender',
}

export const searchResult = (name: string, address: string, chain: string) => ({
    name,
    address,
    chain,
    service: { name: 'ENS', logo: '' },
})
