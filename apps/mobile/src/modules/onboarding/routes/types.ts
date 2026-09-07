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

import type {
    WalletAccount,
    HDWalletAccount,
    ImportAccountType,
    DerivationType,
} from '@perawallet/wallet-core-accounts'
import type { LedgerTransportType } from '@perawallet/wallet-core-hardware-wallet'
import type { Optional } from '@perawallet/wallet-core-shared'
import type {
    SerializedLedgerAccount,
    SerializedLedgerSelectableAccount,
} from '@modules/ledger'

/**
 * Where to go after an account is created + named, instead of the default
 * exit-to-Home. A generic nested-navigation descriptor so a flow (e.g. Pera
 * Card's Connect Funds) can resume itself without coupling the shared account
 * creation flow to it. Consumed by `useExitAccountFlow`.
 */
export type PostCreateReturnTarget = {
    name: string
    params?: object
}

export type SearchAccountsParams =
    | {
          mode?: 'existing'
          account: WalletAccount
          /**
           * If discovery finds only the master account, create the next
           * sequential HD address as a fallback. Used by the "Add account from
           * existing HD wallet" flow where the user explicitly wants to add a
           * new address.
           */
          createIfEmpty?: boolean
          /**
           * If discovery finds only the master account and no rekeyed accounts,
           * surface a "No new addresses found" toast before exiting. Used by
           * the AccountInfoCard "Scan new addresses" entry point so the user
           * gets feedback that the scan completed without results. Mutually
           * exclusive with `createIfEmpty`.
           */
          notifyOnEmpty?: boolean
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
        /** Override the post-naming destination (defaults to exit-to-Home). */
        returnTo?: PostCreateReturnTarget
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
    LedgerScan: Optional<{ transportType?: LedgerTransportType }>
    LedgerFetchAccounts: {
        deviceId: string
        deviceName: string
        transportType: LedgerTransportType
    }
    LedgerSelectAccounts: {
        deviceId: string
        deviceName: string
        transportType: LedgerTransportType
        accounts: SerializedLedgerAccount[]
    }
    LedgerVerify: {
        deviceId: string
        deviceName: string
        transportType: LedgerTransportType
        selectedAccounts: SerializedLedgerSelectableAccount[]
    }
    LedgerTroubleshooting: undefined
    AsbImportInfo: undefined
    AsbImportBackup: undefined
    AsbImportKey: undefined
    AsbImportSelectAccounts: undefined
    AsbImportResult: {
        importedCount: number
        skippedDuplicateCount: number
        failedCount: number
    }
    PeraWebImportInfo: undefined
    PeraWebImportLoading: undefined
    PeraWebImportResult: {
        importedCount: number
        skippedDuplicateCount: number
        failedCount: number
    }
}

export type OnboardingStackParamList = ImportFlowParamList & {
    OnboardingHome: undefined
}

export type AddAccountStackParamList = ImportFlowParamList & {
    AddAccountHome: undefined
    SelectHDWallet: Optional<{
        /** Forwarded to NameAccount so the caller's flow can resume after naming. */
        returnTo?: PostCreateReturnTarget
    }>
    WatchInfo: undefined
    WatchAccount: Optional<{
        // Set by the watch-account / register-watch-account deeplinks so the
        // address field starts populated and the user only has to confirm.
        prefillAddress?: string
    }>
}
