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

/** Home screen actions. */
export enum HomeEvent {
    AccountAdd = 'homescr_account_add', // Started adding an account from the account picker
    QrScan = 'homescr_qr_scan', // Opened the QR scanner from the home header
    PasteLink = 'homescr_paste_link_tap', // Tapped paste-a-link in the home header
    QrConnected = 'homescr_qr_scan_connected', // A home QR scan established a WalletConnect session
    Send = 'homescr_send_click', // Opened Send from the home overview
    Receive = 'homescr_receive_click', // Opened Receive from the home overview (RN-specific)
    Fund = 'homescr_fund_click', // Tapped Buy on the no-funds panel (navigates to Fund)
    Sort = 'homescr_sort_tap', // Sorted the account list
    Swap = 'homescr_swap_click', // Tapped Swap on the home button panel
    Notification = 'homescr_notification_tap', // Opened the inbox from the home notifications icon
    Chart = 'homescr_chart_tap', // Toggled the portfolio chart on the home overview
}
