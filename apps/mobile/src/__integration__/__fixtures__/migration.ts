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

import { mnemonicToEntropy } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import { mnemonicToSecretKey } from 'algosdk'
import type {
    LegacyAccount,
    LegacyHDWallet,
    MigrationService,
} from '@perawallet/wallet-extension-platform'
import { createStubMigrationService } from '@perawallet/wallet-extension-platform/test-utils'
import { getPlatformServices } from '@test-utils/platform-driver-test'

import {
    ALGO25_TEST_MNEMONIC,
    HD_TEST_ADDRESS,
    HD_TEST_MNEMONIC_24,
} from './onboarding'

// Specs using these must `vi.unmock` both
// '@perawallet/wallet-extension-platform' and its '-driver': the default mocks
// carry no migration service.

const legacyAccount = (
    overrides: Partial<LegacyAccount> & Pick<LegacyAccount, 'address'>,
): LegacyAccount => ({
    name: 'Account',
    type: 'standard',
    preferredOrder: 0,
    isBackedUp: true,
    secretKey: null,
    hdSeedId: null,
    ledger: null,
    joint: null,
    authAddress: null,
    ...overrides,
})

/**
 * A signable Pera 6 standard account. Its 64-byte secret key's first 32 bytes
 * are the ed25519 seed for ALGO25_TEST_ADDRESS, which migration rebuilds the
 * algo25 mnemonic from.
 */
export const legacyAlgo25Account = (
    address: string,
    overrides: Partial<LegacyAccount> = {},
): LegacyAccount =>
    legacyAccount({
        address,
        name: 'Trading',
        secretKey: mnemonicToSecretKey(ALGO25_TEST_MNEMONIC).sk,
        ...overrides,
    })

/** A keyless account rekeyed to `authAddress`, which migration records as its authority. */
export const legacyKeylessAccount = (
    address: string,
    { authAddress }: { authAddress: string },
): LegacyAccount =>
    legacyAccount({
        address,
        name: 'Rekeyed',
        type: 'watch',
        preferredOrder: 1,
        isBackedUp: false,
        authAddress,
    })

export const LEGACY_HD_WALLET_ID = 'legacy-hd-wallet'

/** HD_TEST_MNEMONIC_24's wallet holding HD_TEST_ADDRESS, account 0 key 0. */
export const legacyHdWallet = (): LegacyHDWallet => ({
    walletId: LEGACY_HD_WALLET_ID,
    name: null,
    entropy: mnemonicToEntropy(HD_TEST_MNEMONIC_24, wordlist),
    keys: [
        {
            address: HD_TEST_ADDRESS,
            account: 0,
            change: 0,
            keyIndex: 0,
            derivationType: 32,
            privateKey: null,
        },
    ],
})

export const legacyHdAccount = (
    overrides: Partial<LegacyAccount> = {},
): LegacyAccount =>
    legacyAccount({
        address: HD_TEST_ADDRESS,
        name: 'Main',
        hdSeedId: LEGACY_HD_WALLET_ID,
        ...overrides,
    })

/**
 * Points the provider's migration service at a stub. The provider holds the
 * driver's service object, so its methods are rebound in place rather than
 * the object replaced.
 */
export const installStubMigrationService = (
    options: Parameters<typeof createStubMigrationService>[0],
): void => {
    const stub = createStubMigrationService(options)
    const target = getPlatformServices().migration
    const rebound: MigrationService = {
        hasLegacyData: () => stub.hasLegacyData(),
        getLegacyData: () => stub.getLegacyData(),
        isMigrationComplete: () => stub.isMigrationComplete(),
        markMigrationComplete: platform => stub.markMigrationComplete(platform),
        clearMigrationComplete: () => stub.clearMigrationComplete(),
        getMigrationPlans: () => stub.getMigrationPlans(),
        resetLegacyData: () => stub.resetLegacyData(),
        getCompletedStepVersions: () => stub.getCompletedStepVersions(),
        setCompletedStepVersions: versions =>
            stub.setCompletedStepVersions(versions),
    }
    Object.assign(target, rebound)
}
