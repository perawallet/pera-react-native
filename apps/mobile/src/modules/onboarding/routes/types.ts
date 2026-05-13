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
    DerivationType,
} from '@perawallet/wallet-core-accounts'
import type { LedgerTransportType } from '@perawallet/wallet-core-hardware-wallet'
import type { LedgerAccount } from '@perawallet/wallet-core-ledger'
import type { Optional } from '@perawallet/wallet-core-shared'

export type SearchAccountsParams =
    | {
          mode?: 'existing'
          account: WalletAccount
          createIfEmpty?: boolean
      }
    | {
          mode: 'import'
          walletKeyId: string
          derivationType: DerivationType
      }

export type ImportSelectAddressesParams =
    | {
          mode?: 'existing'
          accounts: HDWalletAccount[]
      }
    | {
          mode: 'import'
          walletKeyId: string
          accounts: HDWalletAccount[]
      }

/**
 * Param list for screens shared between OnboardingStackNavigator and
 * AddAccountStackNavigator. Both flows reach these screens after the user
 * picks an import method on `ImportAccountOptions`. Registered in one place
 * via `renderImportFlowScreens` (see `./shared-screens.tsx`).
 */
export type ImportFlowParamList = {
    ImportAccountOptions: undefined
    NameAccount: Optional<{
        account?: WalletAccount
    }>
    ImportSelectAddresses: ImportSelectAddressesParams
    ImportRekeyedAddresses: {
        accounts: WalletAccount[]
    }
    ImportInfo: {
        accountType: ImportAccountType
    }
    ImportAccount: {
        accountType: ImportAccountType
    }
    SearchAccounts: SearchAccountsParams
    LedgerPair: undefined
    LedgerInstructions: Optional<{ transportType?: LedgerTransportType }>
    LedgerScan: undefined
    LedgerFetchAccounts: {
        deviceId: string
        deviceName: string
        transportType: LedgerTransportType
    }
    LedgerSelectAccounts: {
        deviceId: string
        deviceName: string
        transportType: LedgerTransportType
        accounts: LedgerAccount[]
    }
    LedgerVerify: {
        deviceId: string
        deviceName: string
        transportType: LedgerTransportType
        selectedAccounts: LedgerAccount[]
    }
    LedgerTroubleshooting: undefined
}

export type OnboardingStackParamList = ImportFlowParamList & {
    OnboardingHome: undefined
}

export type AddAccountStackParamList = ImportFlowParamList & {
    AddAccountHome: undefined
    SelectHDWallet: undefined
    WatchInfo: undefined
    WatchAccount: undefined
}
