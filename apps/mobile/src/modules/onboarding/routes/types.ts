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

import {
    WalletAccount,
    HDWalletAccount,
    ImportAccountType,
    DiscoveredRekeyedAccount,
} from '@perawallet/wallet-core-accounts'
import type { LedgerAccount } from '@perawallet/wallet-core-ledger'

export type OnboardingStackParamList = {
    OnboardingHome: undefined
    NameAccount:
        | {
              account?: WalletAccount
          }
        | undefined
    ImportSelectAddresses: {
        accounts: HDWalletAccount[]
    }
    ImportRekeyedAddresses: {
        accounts: DiscoveredRekeyedAccount[]
    }
    ImportInfo: {
        accountType: ImportAccountType
    }
    ImportAccount: {
        accountType: ImportAccountType
        mnemonic?: string
    }
    SearchAccounts: {
        account: WalletAccount
        createIfEmpty?: boolean
    }
    LedgerInstructions: undefined
    LedgerScan: undefined
    LedgerFetchAccounts: {
        deviceId: string
        deviceName: string
    }
    LedgerSelectAccounts: {
        deviceId: string
        deviceName: string
        accounts: LedgerAccount[]
    }
    LedgerVerify: {
        deviceId: string
        deviceName: string
        selectedAccounts: LedgerAccount[]
    }
    LedgerTroubleshooting: undefined
}

export type AddAccountStackParamList = {
    AddAccountHome: undefined
    ImportAccountOptions: undefined
    SelectHDWallet: undefined
    WatchInfo: undefined
    WatchAccount: undefined
    NameAccount:
        | {
              account?: WalletAccount
          }
        | undefined
    ImportSelectAddresses: {
        accounts: HDWalletAccount[]
    }
    ImportRekeyedAddresses: {
        accounts: DiscoveredRekeyedAccount[]
    }
    ImportInfo: {
        accountType: ImportAccountType
    }
    ImportAccount: {
        accountType: ImportAccountType
        mnemonic?: string
    }
    SearchAccounts: {
        account: WalletAccount
        createIfEmpty?: boolean
    }
    LedgerInstructions: undefined
    LedgerScan: undefined
    LedgerFetchAccounts: {
        deviceId: string
        deviceName: string
    }
    LedgerSelectAccounts: {
        deviceId: string
        deviceName: string
        accounts: LedgerAccount[]
    }
    LedgerVerify: {
        deviceId: string
        deviceName: string
        selectedAccounts: LedgerAccount[]
    }
    LedgerTroubleshooting: undefined
}
