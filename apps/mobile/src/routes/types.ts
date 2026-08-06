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

import { type NavigatorScreenParams } from '@react-navigation/native'
import {
    type OnboardingStackParamList,
    type AddAccountStackParamList,
} from '@modules/onboarding/routes/types'
import { type TabBarStackParamList } from '@routes/tabbar'
import { type SettingsStackParamsList } from '@modules/settings/routes'
import { type ContactsStackParamsList } from '@modules/contacts/routes'
import { type AccountStackParamsList } from '@modules/accounts/routes/types'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import type { TransactionHistoryItem } from '@perawallet/wallet-core-transactions'
import { type MessagesStackParamList } from '@modules/messages/routes'
import { type MultisigStackParamList } from '@modules/multisig'
import {
    type PeraCardStackParamList,
    type CardOnboardingStackParamList,
    type PeraCardFlowParamList,
} from '@modules/card'
import type { BackupStackParamList } from '@modules/backup/routes/types'
import { type SearchStackParamsList } from '@modules/search'
import type { RekeyToLedgerStackParamList } from '@modules/rekey/routes/rekey-to-ledger'
import type { RekeyToSharedStackParamList } from '@modules/rekey/routes/rekey-to-shared'
import type { RekeyToStandardStackParamList } from '@modules/rekey/routes/rekey-to-standard'
import type { RescanRekeyedStackParamList } from '@modules/rekey/routes/rescan-rekeyed'
import type { UndoRekeyStackParamList } from '@modules/rekey/routes/undo-rekey'

export type RootStackParamList = {
    MigrationSplash: undefined
    Onboarding: NavigatorScreenParams<OnboardingStackParamList>
    TabBar: NavigatorScreenParams<TabBarStackParamList>
    ScanQR: undefined
    AddAccount: NavigatorScreenParams<AddAccountStackParamList>
    Messages: NavigatorScreenParams<MessagesStackParamList>
    Settings: NavigatorScreenParams<SettingsStackParamsList>
    Contacts: NavigatorScreenParams<ContactsStackParamsList>
    Search: NavigatorScreenParams<SearchStackParamsList>
    Multisig: NavigatorScreenParams<MultisigStackParamList>
    PeraCard: NavigatorScreenParams<PeraCardStackParamList>
    BackupWallet: NavigatorScreenParams<BackupStackParamList>
    RekeyToStandard: NavigatorScreenParams<RekeyToStandardStackParamList>
    RekeyToLedger: NavigatorScreenParams<RekeyToLedgerStackParamList>
    RekeyToShared: NavigatorScreenParams<RekeyToSharedStackParamList>
    RescanRekeyed: NavigatorScreenParams<RescanRekeyedStackParamList>
    UndoRekey: NavigatorScreenParams<UndoRekeyStackParamList>
    Staking: undefined
    BannersCarouselModal: { bannerId?: string } | undefined
    GroupTransactionList: {
        groupId: string
    }
    TransactionDetails: {
        transactionId?: string
        transaction?: PeraDisplayableTransaction
        /**
         * The SQLite history row the user tapped. Lets the screen render
         * offline from local data while the indexer fetch (enrichment)
         * is paused or in flight. Carries Decimal fields, so it must not be
         * persisted or deep-linked — see the same param on
         * `SigningStackParamList['TransactionDetails']`.
         */
        historyTransaction?: TransactionHistoryItem
        groupId?: string
    }
} & PeraCardFlowParamList

export type AppStackParamList = RootStackParamList &
    OnboardingStackParamList &
    AddAccountStackParamList &
    TabBarStackParamList &
    SettingsStackParamsList &
    ContactsStackParamsList &
    AccountStackParamsList &
    MultisigStackParamList &
    PeraCardStackParamList &
    CardOnboardingStackParamList &
    BackupStackParamList &
    RekeyToStandardStackParamList &
    RekeyToLedgerStackParamList &
    RekeyToSharedStackParamList &
    RescanRekeyedStackParamList &
    UndoRekeyStackParamList &
    SearchStackParamsList
