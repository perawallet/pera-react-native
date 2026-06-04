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
    Assets = 'accountscr_assets_tap',
    Collectibles = 'accountscr_collectibles_tap',
    History = 'accountscr_history_tap',
    BuyAlgo = 'acccountscr_buysell_click',
    Fund = 'acccountscr_fund_click',
    Swap = 'accountscr_swap_click',
    AssetInbox = 'accountscr_tapmenu_asset_inbox_tap',
    Send = 'accountscr_tapmenu_send_tap',
    More = 'accountscr_tapmenu_more_tap',
    Chart = 'accountscr_chart_tap',
    TransactionDownload = 'historyscr_transactions_download',
    TransactionFilter = 'historyscr_transactions_filter',
    JointAccountDetail = 'accountscr_jointAccount_detail_press',
    JointAccountRekey = 'accountscr_tapmenu_rekeyJntAcc_tap',
    JointAccountExport = 'accountscr_tapmenu_jntAccExport_tap',
    JointAccountCopyUrl = 'accountscr_tapmenu_jntAccExpCopy_tap',
    JointAccountShareUrl = 'accountscr_tapmenu_jntAccExpShare_tap',
}
