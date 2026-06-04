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

/** Account detail screen actions (incl. its joint-account menu items). */
export enum AccountDetailsEvent {
    Assets = 'accountscr_assets_tap', // Tapped the Assets tab on account detail
    Collectibles = 'accountscr_collectibles_tap', // Tapped the Collectibles tab
    History = 'accountscr_history_tap', // Tapped the History tab
    BuyAlgo = 'acccountscr_buysell_click', // Tapped buy/sell
    Fund = 'acccountscr_fund_click', // Tapped Fund
    Swap = 'accountscr_swap_click', // Tapped Swap
    AssetInbox = 'accountscr_tapmenu_asset_inbox_tap', // Opened the asset inbox from the account menu
    Send = 'accountscr_tapmenu_send_tap', // Tapped Send from the account menu
    More = 'accountscr_tapmenu_more_tap', // Tapped More in the account menu
    Chart = 'accountscr_chart_tap', // Tapped the chart
    TransactionDownload = 'historyscr_transactions_download', // Downloaded transaction history
    TransactionFilter = 'historyscr_transactions_filter', // Filtered transaction history
    JointAccountDetail = 'accountscr_jointAccount_detail_press', // Opened joint-account detail
    JointAccountRekey = 'accountscr_tapmenu_rekeyJntAcc_tap', // Rekeyed a joint account
    JointAccountExport = 'accountscr_tapmenu_jntAccExport_tap', // Exported a joint account
    JointAccountCopyUrl = 'accountscr_tapmenu_jntAccExpCopy_tap', // Copied the joint-account export URL
    JointAccountShareUrl = 'accountscr_tapmenu_jntAccExpShare_tap', // Shared the joint-account export URL
}
