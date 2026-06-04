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
    AccountAdd = 'homescr_account_add',
    AssetInbox = 'homescr_asset_inbox_tap',
    QrScan = 'homescr_qr_scan',
    QrConnected = 'homescr_qr_scan_connected',
    BuyAlgo = 'homescr_buysell_click',
    Send = 'homescr_send_click',
    Fund = 'homescr_fund_click',
    Sort = 'homescr_sort_tap',
    Stake = 'homescr_stake_click',
    Swap = 'homescr_swap_click',
    Notification = 'homescr_notification_tap',
    Chart = 'homescr_chart_tap',
}
