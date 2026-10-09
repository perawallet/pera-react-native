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
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { buildAccount } from '../credentials'
import type { AccountChains, AccountCustody, WalletAccount } from '../models'
import {
    FAKE_CHAIN_ID,
    FAKE_EXPLICIT_SEED,
    FAKE_HD_SEED,
    FAKE_SINGLE_SEED,
} from './fakeAccountsChain'

/** A valid account, built the same way production code builds one, on the first chain of `chains`. */
export const buildTestAccount = (
    custody: AccountCustody,
    chains: AccountChains,
    overrides: Partial<WalletAccount> = {},
): WalletAccount => {
    const chainId = Object.keys(chains)[0] as ChainId
    return { ...buildAccount({ custody, chainId, chains }), ...overrides }
}

export const TEST_CUSTODY = {
    local: { kind: 'local', seed: FAKE_SINGLE_SEED },
    explicit: { kind: 'local', seed: FAKE_EXPLICIT_SEED },
    hd: { kind: 'local', seed: FAKE_HD_SEED, hd: { account: 0, keyIndex: 0 } },
    hardware: {
        kind: 'hardware',
        device: {
            manufacturer: 'ledger',
            deviceId: 'device-1',
            deviceName: 'Nano X',
            transportType: 'ble',
        },
        accountIndex: 0,
    },
    multisig: { kind: 'multisig' },
    watch: { kind: 'watch' },
} as const satisfies Record<string, AccountCustody>

export type TestCustody = keyof typeof TEST_CUSTODY

/** An account of `custody` on the fake chain; a local one gets a key. */
export const testAccount = (
    custody: TestCustody,
    address = `${custody.toUpperCase()}-ADDR`,
    overrides: Partial<WalletAccount> = {},
): WalletAccount => {
    const held = TEST_CUSTODY[custody]
    return buildTestAccount(
        held,
        {
            [FAKE_CHAIN_ID]: {
                address,
                ...(held.kind === 'local'
                    ? { keyPairId: `${custody}-key` }
                    : {}),
            },
        },
        overrides,
    )
}
