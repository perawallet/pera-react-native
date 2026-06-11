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

/**
 * Native onramp (Buy) flow. Event names mirror the legacy onramp-mobile-web
 * webview app's analytics so dashboards stay continuous across the migration.
 */
export enum OnrampEvent {
    WelcomeContinue = 'onramp_welcome_continue', // Tapped "Get started" on the intro sheet
    HistoryTabSelect = 'onramp_history_tab_select', // Opened the buy-history sheet
    SenderAddressOpen = 'onramp_sender_address_open', // Opened the sender-address sheet (XO)
    SenderAddressApply = 'onramp_sender_address_apply', // Applied a sender address (XO)
    TopCurrencyTap = 'onramp_top_currency_tap', // Opened the pay/source token selector
    BottomCurrencyTap = 'onramp_bottom_currency_tap', // Opened the receive/destination token selector
    ProceedTap = 'onramp_proceed_tap', // Tapped Buy / proceed to create the order
    TosAccept = 'onramp_tos_accept', // Accepted the terms & conditions
    ProviderTap = 'onramp_provider_tap', // Opened the provider selector
    ProviderSelect = 'onramp_provider_select', // Picked a specific provider quote
    HistoryCategoryTap = 'onramp_history_category_tap', // Picked a status filter in buy history
    HistoryTransactionTap = 'onramp_history_transaction_tap', // Tapped a buy-history transaction
}
