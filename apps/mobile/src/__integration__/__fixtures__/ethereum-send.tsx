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

// Shared by the flows that send ether from an Ethereum account.

import { expect } from 'vitest'
import { Decimal } from 'decimal.js'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { getPendingTransactionRecords } from '@perawallet/wallet-core-transactions'
import {
    upsertAccountChainState,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { nativeAssetFor, upsertAssets } from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { SeedScheme } from '@perawallet/wallet-core-kms'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { findEnabledByTestId } from '@test-utils/rnw'
import { ALGO25_TEST_ADDRESS } from './onboarding'

export const ETH_SCOPE: ChainScope = {
    chainId: 'ethereum',
    networkId: 'mainnet',
}

// Hardhat accounts #0 and #1, from the public test mnemonic.
export const SENDER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
export const RECEIVER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
export const UNKNOWN_RECIPIENT = '0x000000000000000000000000000000000000dEaD'
export const TOKEN = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
// A contract no test token list names.
export const UNLISTED_TOKEN = '0x5555555555555555555555555555555555555555'

// An HD account, so its signing scheme resolves without the keystore loading
// the key.
export const ETHEREUM_SENDER: WalletAccount = {
    id: 'eth-sender',
    custody: {
        kind: 'local',
        seed: SeedScheme.Bip39,
        hd: { account: 0, keyIndex: 0 },
    },
    chains: { ethereum: { address: SENDER, keyPairId: 'eth-key' } },
    name: 'Eth sender',
}

export const ALGORAND_SENDER: WalletAccount = {
    id: 'algo-sender',
    custody: { kind: 'local', seed: null },
    chains: {
        algorand: { address: ALGO25_TEST_ADDRESS, keyPairId: 'algo-key' },
    },
    name: 'Algo sender',
}

export const selectSender = (account: WalletAccount) => {
    useAccountsStore.getState().setAccounts([account])
    useAccountsStore.getState().setSelectedAccountId(account.id)
}

// Ethereum keys never exist in JS, and the in-memory keystore holds none, so
// the KMS answers with signatures Hardhat #0 made over these exact digests, in
// its r‖s‖recovery encoding. The RPC fixture defaults (nonce 0, 21000 gas,
// 1 gwei base fee and tip) make each build deterministic; a digest missing
// here means the build changed and the signature must be regenerated.
export const SENDER_SIGNATURES: Record<string, string> = {
    // 0.5 ETH to RECEIVER.
    '4c7de634dc88b13890e379a0156d0c4f1e4dd515384bf403285c40e2e3191177':
        '923c0f4c3ec362322e052c7d1f1d6ea2a364621802f4428c6508a4fe71a655ef332789ab7ace0f5c627bcda10589e4e437c568bfb39cd09f4dc40da8789c05ac01',
    // MAX ether to RECEIVER at send-ethereum.spec's 1 / 2 / 3 gwei tips: 10 ETH less 21000 x 3 gwei (slow) ...
    c8ade2d7f62900de2edd5f323ecdf69ee1e9522ce2aac52d2157102b34111284:
        '2a6df7e334bf12e2ebd184a4048c539219537cccade71b9b60bd0659754162d919cf0b6f1ea67f83954c4ff05f60f22d9132bd4a358eeee2af4b267800a55edd01',
    // ... and 10 ETH less 21000 x 4 gwei (normal).
    '90fac667aad1a634739d01e2823d7da0caa379757a3afa6331859377cb65ef42':
        '791adf986b26f0aeabb69961bec577d4fed0ad0534722123c4881c9ee84cb8f21a86a6dbacc3ceacfbb595cc9f71662cb3af58fd38c082a42b613cee122e3ca100',
    // 0.5 ETH to RECEIVER at send-ethereum.spec's Fast tip: 21000 x 5 gwei.
    '484bbbeb2619becc52b946f2fd8edae806d76bab00f40582ed54071336ad3d13':
        '1b8079e22474d28909df616bb9fe104cb59ab0480aed83ebc2c008e83fcb80a24d9dcb15c6ba875561251f5d5339ea759466a9f9ea13fada08a1260680f9d89800',
    // 12.5 USDC to RECEIVER.
    '9fb86b86dc2f2049311d8e7f546c5ec37a26292006ba046332e4e5f34af71644':
        'f3c568bd1aff4046a6c9b73aeed1af980ba26029d498707a9ad018f73ccf793949d3dba1d1a62cdc88ff598ef04c2a94ce063db4de0fa750eeb1dd18aa6b31f801',
    // 12.5 UNLISTED_TOKEN to RECEIVER.
    d2f6cb427a35898a0965f278a65436e253f267b5df29927c082e2186ba2e653e:
        '4071153ceceaca69fc10b43e29eadd4e52d19d00c7df7591ceb2899a92ccbb0139554e73077ad2618491ad51afd419bfe56eb9fba126f59778b40761941a9ce500',
    // swap-ethereum.spec's spend approval of 12.5 TOKEN to its router.
    '03f630dd8a2d4b52b6e46e2df5a75573c6b2d760067fd1c019fcb1c1a5eb2298':
        '2194433408a452c3a9efab5716f094198696e2e75ee94d4eca75d2354252a5f100a4f58b71b84ed3cd121583186161f17be30bad2db098471bb833b07924596c01',
    // Its token swap with nonce 0, where the allowance already covers it.
    '393659e2ba4d154e1c9e10368f32ae57938d5ced24fa48a954dadb521195cbe5':
        '0459c870a914336d91357bce04fbf9256a728f726526acb8ca85391a73caea3c753cd20dd356510f40b59364f9b1b98aaf82ab2b900c42b7abb13880b74273cf00',
    // Its ether swap.
    '985de06a9bb64b1bc972ef1568dfb135eac9410fa148ea272b8a97f59979e5c7':
        '057e0d329eff2cc09432512751deeb6a916c4cf0a36143b3996e995b3c398a7e692c2fed477d3f967cfc0a030d99f0770988d93c6d0bd832eb9bd45eb412b35c01',
    // Its token swap with nonce 1, after that approval.
    '145988f3f10f6fac76917939006b17d3460372b96d47350ba72e69f4dd2dcc68':
        'a7240ade3fd0663e4a0dc33976a0a99576f7c64e686ecfd2f2da62e193188409468137b6c8a7ec9887de6c02770043de07f754c7b5ad17de62364e12e36366e901',
}

export const signWithSenderKey = async (
    _keyPairId: string,
    digest: Uint8Array,
) => {
    const hex = Buffer.from(digest).toString('hex')
    const signature = SENDER_SIGNATURES[hex]
    if (!signature) throw new Error(`No fixture signature for digest ${hex}`)
    return Uint8Array.from(Buffer.from(signature, 'hex'))
}

export const sentRecord = async () => {
    const [record] = await getPendingTransactionRecords({
        address: SENDER,
        scope: ETH_SCOPE,
        listedIds: new Set(),
    })
    return record
}

export const seedEthereumAssets = async () => {
    const ether = nativeAssetFor('ethereum')
    await upsertAssets({
        items: [
            ether,
            {
                ...ether,
                assetId: TOKEN,
                name: 'USD Coin',
                unitName: 'USDC',
                decimals: 6,
            },
        ],
        scope: ETH_SCOPE,
    })
}

// The confirm step checks the synced native balance covers the worst-case fee.
export const seedSenderEther = (wei: string) =>
    upsertAccountChainState({
        accountAddress: SENDER,
        scope: ETH_SCOPE,
        nativeBalance: new Decimal(wei),
        chainData: { family: 'evm', nonce: { latest: 0, pending: 0 } },
    })

type Screen = Parameters<typeof renderWithNavigation>[0]

/** The screens come from the caller: a spec may import a module's screens, a shared fixture may not. */
export type SendConfirmationScreens = {
    confirmation: Screen
    processing: Screen
    success: Screen
}

export const renderSendConfirmationStack = (screens: SendConfirmationScreens) =>
    renderWithNavigation(screens.confirmation, 'ConfirmTransaction', {
        additionalScreens: [
            { name: 'TransactionProcessing', component: screens.processing },
            { name: 'TransactionSuccess', component: screens.success },
        ],
    })

export const confirmSend = async () => {
    fireEvent.click(
        await findEnabledByTestId('send_confirm_button', { timeout: 5000 }),
    )
    await waitFor(
        () => expect(screen.getByTestId('send_success')).toBeTruthy(),
        {
            timeout: 10_000,
        },
    )
}
