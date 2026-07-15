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

/**
 * Account actions on the home surface that aren't covered by `HomeEvent`: the
 * sub-tabs, history controls, the account options menu, and joint-account items.
 * Actions shared with the home quick-actions (send, buy, swap, fund, chart, asset
 * inbox) fire their `HomeEvent` counterpart instead.
 */
export enum AccountDetailsEvent {
    Assets = 'accountscr_assets_tap', // Switched to the Overview/Assets tab
    Collectibles = 'accountscr_collectibles_tap', // Switched to the NFTs tab
    History = 'accountscr_history_tap', // Switched to the History tab
    More = 'accountscr_tapmenu_more_tap', // Opened the account options menu
    TransactionDownload = 'historyscr_transactions_download', // Downloaded transaction history
    TransactionFilter = 'historyscr_transactions_filter', // Filtered transaction history
    JointAccountDetail = 'accountscr_jointAccount_detail_press', // Opened joint-account detail
    JointAccountRekey = 'accountscr_tapmenu_rekeyJntAcc_tap', // Rekeyed a joint account
    JointAccountExport = 'accountscr_tapmenu_jntAccExport_tap', // Exported a joint account
    JointAccountCopyUrl = 'accountscr_tapmenu_jntAccExpCopy_tap', // Copied the joint-account export URL
    JointAccountShareUrl = 'accountscr_tapmenu_jntAccExpShare_tap', // Shared the joint-account export URL
}
