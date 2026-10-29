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

// @vitest-environment node

import { describe, expect, expectTypeOf, it } from 'vitest'
import * as contexts from '../contexts'
import {
    AccountDetailsEvent,
    AccountOptionsEvent,
    AssetDetailsEvent,
    BannersEvent,
    CardEvent,
    CloudBackupEvent,
    ContactsEvent,
    FundEvent,
    HomeEvent,
    MenuEvent,
    MultisigEvent,
    NavigationEvent,
    NotificationsEvent,
    OnboardingEvent,
    OnrampEvent,
    PasskeysEvent,
    SettingsEvent,
    StakingEvent,
    SwapEvent,
    TabbarEvent,
    TransactionsEvent,
    VaultEvent,
    WalletConnectEvent,
    WebviewEvent,
} from '../contexts'
import type { ChainScopedEvent } from '../chain-payload'

const CHAIN_SCOPED_EVENTS = [
    OnboardingEvent.NameAccount,
    OnboardingEvent.RegisterAccount,
    OnboardingEvent.WatchAccountComplete,
    OnboardingEvent.RecoverAlgo25,
    OnboardingEvent.RecoverOneKey,
    OnboardingEvent.CreateAccountQuantum,
    OnboardingEvent.RekeyAccount,
    HomeEvent.Send,
    HomeEvent.Receive,
    HomeEvent.Swap,
    HomeEvent.Fund,
    SettingsEvent.ChangeNotificationFilter,
    ...Object.values(AssetDetailsEvent),
    ...Object.values(AccountDetailsEvent),
    ...Object.values(AccountOptionsEvent),
    ...Object.values(TransactionsEvent),
    ...Object.values(WalletConnectEvent),
    ...Object.values(SwapEvent),
    ...Object.values(OnrampEvent),
    ...Object.values(StakingEvent),
    ...Object.values(MultisigEvent),
] as const satisfies readonly ChainScopedEvent[]

const CHAIN_AGNOSTIC_EVENTS: readonly string[] = [
    // Fired before an address, and so a chain, exists.
    OnboardingEvent.CreateNewWallet,
    OnboardingEvent.ImportAccount,
    OnboardingEvent.CreateAccountWatch,
    // A recovery phrase covers every chain of its wallet.
    OnboardingEvent.BeginPassphrase,
    OnboardingEvent.UnderstandPassphrase,
    OnboardingEvent.VerifyPassphrase,
    OnboardingEvent.VerifyPassphraseComplete,
    // Home header and list controls act on no single account.
    HomeEvent.AccountAdd,
    HomeEvent.QrScan,
    HomeEvent.PasteLink,
    HomeEvent.QrConnected,
    HomeEvent.Sort,
    HomeEvent.Notification,
    HomeEvent.Chart,
    // App-wide preferences.
    SettingsEvent.ChangeCurrency,
    SettingsEvent.PassKey,
    SettingsEvent.CloudBackup,
    ...Object.values(PasskeysEvent),
    ...Object.values(CloudBackupEvent),
    // The vault is the extension's lock, above any account or chain.
    ...Object.values(VaultEvent),
    // App chrome and navigation, before any account is picked.
    ...Object.values(TabbarEvent),
    ...Object.values(MenuEvent),
    ...Object.values(NavigationEvent),
    ...Object.values(WebviewEvent),
    ...Object.values(BannersEvent),
    // Opened from the menu before an account is picked.
    ...Object.values(FundEvent),
    // Opened before the app resolves which account the notification concerns.
    ...Object.values(NotificationsEvent),
    // A contact holds an address per chain family, not one chain.
    ...Object.values(ContactsEvent),
    // Pera Card runs on its own card account, outside the chain accounts.
    ...Object.values(CardEvent),
]

const allEvents = Object.entries(contexts)
    .filter(([name]) => name.endsWith('Event'))
    .flatMap(([, value]) => Object.values(value as Record<string, string>))

describe('analytics chain scope', () => {
    it('lists exactly the events whose payload must name a chain', () => {
        expectTypeOf<
            (typeof CHAIN_SCOPED_EVENTS)[number]
        >().toEqualTypeOf<ChainScopedEvent>()
    })

    it('classifies every event as chain-scoped or chain-agnostic, never both', () => {
        const scoped = new Set<string>(CHAIN_SCOPED_EVENTS)
        const agnostic = new Set(CHAIN_AGNOSTIC_EVENTS)

        expect([...scoped].filter(event => agnostic.has(event))).toEqual([])
        expect(new Set([...scoped, ...agnostic])).toEqual(new Set(allEvents))
    })
})
