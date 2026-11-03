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
package com.algorand.perarn.perawidgets.widgets

import com.algorand.perarn.perawidgets.config.resolveAccount
import com.algorand.perarn.perawidgets.fetch.Cached
import com.algorand.perarn.perawidgets.fetch.QuoteKeys
import com.algorand.perarn.perawidgets.fetch.TransactionKind
import com.algorand.perarn.perawidgets.fetch.TransactionRow
import com.algorand.perarn.perawidgets.fetch.TransactionsQuote
import com.algorand.perarn.perawidgets.snapshot.WidgetSnapshot
import com.algorand.perarn.perawidgets.snapshot.string

// The most rows any size shows; one fetch serves every size.
const val TRANSACTIONS_FETCH_LIMIT = 6

data class TransactionsContent(
    val title: String,
    // Null before the first fetch and when every request failed; the page then shows the empty line.
    val rows: List<TransactionRow>?,
    val emptyText: String,
    val tapUrl: String,
)

fun transactionsAddresses(snapshot: WidgetSnapshot, accountAddress: String?): List<String> {
    val account = resolveAccount(accountAddress, snapshot)?.address
    return if (account != null) listOf(account) else snapshot.portfolioFeed?.accounts.orEmpty().mapNotNull { it.address }
}

fun transactionsQuoteKey(snapshot: WidgetSnapshot, accountAddress: String?): String? {
    val feed = snapshot.priceFeed ?: return null
    if (snapshot.portfolioFeed == null) return null
    return QuoteKeys.transactions(feed.backendUrl, transactionsAddresses(snapshot, accountAddress), snapshot.locale)
}

// Null in privacy mode and on a network without a Pera backend: the app then shares no account feed.
fun transactionsContent(
    snapshot: WidgetSnapshot,
    accountAddress: String?,
    cached: Cached<TransactionsQuote>?,
): TransactionsContent? {
    if (snapshot.portfolioFeed == null) return null
    val account = resolveAccount(accountAddress, snapshot)
    return TransactionsContent(
        title = account?.name ?: snapshot.string("recentTransactions") ?: "Last transactions",
        rows = cached?.value?.rows,
        emptyText = snapshot.string("noTransactions") ?: "No transactions available",
        tapUrl = account?.address?.let { "perawallet://app/account-detail/?address=$it&tab=history" }
            ?: "perawallet://app/portfolio/",
    )
}

fun transactionLabel(kind: TransactionKind, snapshot: WidgetSnapshot): String {
    val key = when (kind) {
        TransactionKind.Send -> "txSend"
        TransactionKind.Receive -> "txReceive"
        TransactionKind.Swap -> "txSwap"
        TransactionKind.OptIn -> "txOptIn"
        TransactionKind.OptOut -> "txOptOut"
        TransactionKind.AppCall -> "txAppCall"
        TransactionKind.Other -> "transaction"
    }
    return snapshot.string(key).orEmpty()
}

// Direction is carried by the sign and the icon as well as the colour.
fun signedAmount(row: TransactionRow): String? = row.amount?.let {
    when (row.kind) {
        TransactionKind.Send -> "−$it"
        TransactionKind.Receive -> "+$it"
        else -> it
    }
}
