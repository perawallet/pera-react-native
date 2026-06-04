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

/** Home screen actions. */
export enum HomeEvent {
    AccountAdd = 'homescr_account_add', // Tapped add-account on home
    AssetInbox = 'homescr_asset_inbox_tap', // Opened the asset inbox from home
    QrScan = 'homescr_qr_scan', // Tapped QR scan on home
    QrConnected = 'homescr_qr_scan_connected', // A QR scan led to a connection
    BuyAlgo = 'homescr_buysell_click', // Tapped buy/sell on home
    Send = 'homescr_send_click', // Tapped Send on home
    Fund = 'homescr_fund_click', // Tapped Fund on home
    Sort = 'homescr_sort_tap', // Tapped sort on home
    Stake = 'homescr_stake_click', // Tapped Stake on home
    Swap = 'homescr_swap_click', // Tapped Swap on home
    Notification = 'homescr_notification_tap', // Tapped the notifications bell on home
    Chart = 'homescr_chart_tap', // Tapped the chart on home
}
