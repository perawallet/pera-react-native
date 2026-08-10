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
 * Firebase event parameter keys.
 *
 * The enum *values* are the exact raw parameter names sent to Firebase, so they
 * can be used directly as the keys of an event payload object. Sorted by raw value.
 */
export enum AnalyticsMetadataKey {
    AccountType = 'account_type',
    AccountAddress = 'address',
    Amount = 'amount',
    AssetId = 'asset_id',
    AssetInId = 'asset_in',
    AssetOutId = 'asset_out',
    AssetName = 'asset_name',
    CountryId = 'country_id',
    DappName = 'dapp_name',
    DappUrl = 'dapp_url',
    ExchangeFeeAsAlgo = 'exchange_fee_inalgo',
    NetworkFeeAsAlgo = 'network_fee_inalgo',
    Id = 'id',
    InputAmountAsAlgo = 'input_amount_algo',
    InputAmountAsAsa = 'input_amount_asa',
    InputAmountAsUsd = 'input_amount_usd',
    InputAsaId = 'input_asa_id',
    InputAsaName = 'input_asa_name',
    OutputAmountAsAlgo = 'output_amount_algo',
    OutputAmountAsAsa = 'output_amount_asa',
    OutputAmountAsUsd = 'output_amount_usd',
    OutputAsaId = 'output_asa_id',
    OutputAsaName = 'output_asa_name',
    IsMax = 'is_max',
    NotificationId = 'notification_id',
    NotificationUrl = 'notification_url',
    AllowNotifications = 'is_receiving_notifications',
    PeraFeeAsAlgo = 'pera_fee_inalgo',
    PeraFeeAsUsd = 'pera_fee_inusd',
    MismatchFoundAccountAddress = 'received_address',
    MismatchExpectedAccountAddress = 'requested_address',
    Name = 'name',
    Network = 'network',
    Percentage = '%',
    RouterName = 'router_name',
    SenderAccountAddress = 'sender',
    SignedTransaction = 'signed_transaction',
    SwapAddress = 'swap_wallet_address',
    SwapDate = 'swap_date_format',
    SwapDateTimestamp = 'swap_date_timestamp',
    SwapPairing = 'swap_pairing',
    TotalAccount = 'total_account',
    TransactionCount = 'transaction_count',
    TransactionId = 'tx_id',
    AccountCreationType = 'type',
    UnsignedTransaction = 'unsigned_transaction',
    Url = 'url',
    Query = 'query',
    WcSessionUrl = 'wc_session_url',
    WcSessionTopic = 'topic',
    WcRequestId = 'wc_request_id',
    WcRequestUrl = 'wc_request_url',
    WcRequestError = 'wc_request_error',
    WcVersion = 'wc_version',
    WcV2SessionProposalId = 'wc_v2_proposal_id',
    WebviewBridgeMethod = 'webview_bridge_method',
    ScriptMessageHandler = 'script_message_handler',
    ScriptMessage = 'script_message',
    ScreenName = 'screen',
    BannerName = 'banner_name',
    WcActionError = 'wc_action_error',
    ErrorDetails = 'error_details',
    ErrorCause = 'error_root_cause',
    AppGroupName = 'app_group_name',
}
