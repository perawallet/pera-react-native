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
package com.algorand.perarn.perawidgets.fetch

import com.algorand.perarn.perawidgets.format.PriceFormat
import com.algorand.perarn.perawidgets.snapshot.NATIVE_ASSET_ID
import com.algorand.perarn.perawidgets.snapshot.WidgetSnapshot
import java.math.BigDecimal
import java.time.Instant
import java.util.Locale
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

@Serializable
enum class TransactionKind { Send, Receive, Swap, OptIn, OptOut, AppCall, Other }

@Serializable
data class TransactionRow(
    val id: String,
    val kind: TransactionKind,
    // With its unit ("25 ALGO", "USDC → ALGO"); null when nothing worth showing moved (opt-ins, plain app calls).
    val amount: String?,
    @Serializable(with = InstantSerializer::class) val date: Instant,
)

@Serializable
data class TransactionsQuote(
    // Newest first.
    val rows: List<TransactionRow>,
    @Serializable(with = InstantSerializer::class) val fetchedAt: Instant,
)

// Classifies rows by the app's rules (chain-algorand's summarize.ts and history transformers), read from the
// side of the account whose page the row came from.
class TransactionsFetcher(get: HttpGet) {
    private val prices = PriceFetcher(get)

    // Null when every request failed. One request per account, capped so "every account" stays inside a
    // widget refresh's few seconds on wallets with many accounts.
    suspend fun fetch(
        addresses: List<String>,
        limit: Int,
        feed: WidgetSnapshot.PriceFeed,
        locale: Locale,
        now: Instant = Instant.now(),
    ): TransactionsQuote? = coroutineScope {
        if (addresses.isEmpty()) return@coroutineScope null
        val apiKey = feed.apiKey.orEmpty()
        val accounts = addresses.take(MAX_ACCOUNTS)
        val pages = accounts.map { address ->
            async { prices.getJson(feed.backendUrl, "v1/accounts/$address/transactions/?limit=$limit", apiKey) }
        }.awaitAll()
        val loaded = accounts.zip(pages).mapNotNull { (address, page) ->
            FetchJson.array(FetchJson.field(page, "results"))?.let { address to it }
        }
        if (loaded.isEmpty()) return@coroutineScope null
        // A transfer between two of the user's accounts appears in both histories. Pages stay in account order
        // and the sort is stable, so the same side wins on every refresh.
        val seen = HashSet<String>()
        val rows = loaded.flatMap { (address, items) -> items.mapNotNull { item(it, address) } }
            .sortedByDescending { it.roundTime }
            .filter { seen.add(it.id) }
            .take(limit)
            .map { row(it, locale) }
        TransactionsQuote(rows, now)
    }

    private class Item(val json: JsonElement, val account: String, val id: String, val type: String, val roundTime: Double) {
        fun string(name: String): String? = FetchJson.string(FetchJson.field(json, name))
        fun decimal(name: String): BigDecimal? = FetchJson.decimal(FetchJson.field(json, name))
        val sender get() = string("sender")
        val receiver get() = string("receiver")
        val closeTo get() = string("close_to")
        val asset get() = FetchJson.field(json, "asset")?.takeIf { it is JsonObject }
        val impacts get() = FetchJson.array(FetchJson.field(json, "balance_impacts")).orEmpty()
    }

    private fun item(json: JsonElement, account: String): Item? {
        val id = FetchJson.string(FetchJson.field(json, "id")) ?: return null
        val type = FetchJson.string(FetchJson.field(json, "tx_type")) ?: return null
        val roundTime = FetchJson.decimal(FetchJson.field(json, "round_time"))?.toDouble() ?: return null
        return Item(json, account, id, type, roundTime)
    }

    private fun row(item: Item, locale: Locale): TransactionRow {
        val date = Instant.ofEpochMilli((item.roundTime * 1000).toLong())
        fun plain(kind: TransactionKind) = TransactionRow(item.id, kind, null, date)

        FetchJson.field(item.json, "swap_group_detail")?.takeIf { it is JsonObject }?.let { swap ->
            val from = facts(FetchJson.field(swap, "asset_in")).unitName
            val to = facts(FetchJson.field(swap, "asset_out")).unitName
            val amount = if (from.isEmpty() || to.isEmpty()) null else "$from → $to"
            return TransactionRow(item.id, TransactionKind.Swap, amount, date)
        }

        return when (item.type) {
            "pay" -> transfer(item, ALGO, isOutgoing(item, debited = item.sender), date, locale)
            "axfer" -> {
                val assetSender = item.string("asset_sender") ?: derivedClawback(item)
                val paid = item.decimal("amount") ?: BigDecimal.ZERO
                when {
                    assetSender == null && item.sender == item.receiver && paid.signum() == 0 && item.closeTo == null ->
                        plain(TransactionKind.OptIn)
                    assetSender == null && item.closeTo != null -> plain(TransactionKind.OptOut)
                    else -> transfer(item, facts(item.asset), isOutgoing(item, debited = assetSender ?: item.sender), date, locale)
                }
            }
            "appl" -> plain(TransactionKind.AppCall)
            // Key registrations, heartbeats, asset config and freeze, state proofs: no amount, "Transaction".
            else -> plain(TransactionKind.Other)
        }
    }

    private fun transfer(item: Item, facts: AssetFacts, isOut: Boolean, date: Instant, locale: Locale): TransactionRow {
        val paid = item.decimal("amount") ?: BigDecimal.ZERO
        val closed = item.decimal("close_amount") ?: derivedCloseAmount(item)
        // The sender pays both legs; the close target only receives what is addressed to it.
        val value = when {
            isOut -> paid + (closed ?: BigDecimal.ZERO)
            item.closeTo != null && item.closeTo == item.account ->
                if (item.receiver == item.account) paid + (closed ?: BigDecimal.ZERO) else closed ?: BigDecimal.ZERO
            else -> paid
        }
        // Base units on the wire.
        val amount = "${PriceFormat.units(value.movePointLeft(facts.decimals), locale)} ${facts.unitName}".trim()
        return TransactionRow(item.id, if (isOut) TransactionKind.Send else TransactionKind.Receive, amount, date)
    }

    // A clawback authority moving a holding to a third party loses nothing, but "Send" is its closest label.
    private fun isOutgoing(item: Item, debited: String?): Boolean =
        debited == item.account || (item.sender == item.account && item.receiver != item.account)

    // The backend sends no `asnd`: a negative impact on an asset transfer this account didn't send is a clawback.
    private fun derivedClawback(item: Item): String? {
        if (item.sender == item.account) return null
        val assetId = FetchJson.string(FetchJson.field(item.asset, "asset_id"))
        val impact = item.impacts.firstOrNull { impactAssetId(it) == assetId } ?: return null
        val amount = FetchJson.decimal(FetchJson.field(impact, "amount")) ?: return null
        return if (amount.signum() < 0) item.account else null
    }

    // The backend sends no `close_amount`; the account's balance impact holds the sweep exactly (the sender's
    // nets amount + close, plus the fee on ALGO). A non-positive result means an unexpected shape: no guess.
    private fun derivedCloseAmount(item: Item): BigDecimal? {
        if (item.closeTo == null) return null
        val isPay = item.type == "pay"
        val key = if (isPay) NATIVE_ASSET_ID else FetchJson.string(FetchJson.field(item.asset, "asset_id"))
        val impact = item.impacts.firstOrNull { impactAssetId(it) == key } ?: return null
        val impactAmount = FetchJson.decimal(FetchJson.field(impact, "amount")) ?: return null
        val paid = item.decimal("amount") ?: BigDecimal.ZERO
        val closed = when (item.account) {
            item.sender -> impactAmount.negate() - paid - (if (isPay) item.decimal("fee") ?: BigDecimal.ZERO else BigDecimal.ZERO)
            item.closeTo -> impactAmount - (if (item.receiver == item.account) paid else BigDecimal.ZERO)
            else -> return null
        }
        return closed.takeIf { it.signum() > 0 }
    }

    private data class AssetFacts(val unitName: String, val decimals: Int)

    // ALGO's facts are fixed: the backend sends an `asset(0)` placeholder with 0 decimals when its enrichment fails.
    // An unknown asset keeps the backend's decimals, defaulting to 0, as the app's transformer does.
    private fun facts(asset: JsonElement?): AssetFacts {
        if (FetchJson.string(FetchJson.field(asset, "asset_id")) == NATIVE_ASSET_ID) return ALGO
        return AssetFacts(
            FetchJson.string(FetchJson.field(asset, "unit_name")).orEmpty(),
            FetchJson.decimal(FetchJson.field(asset, "fraction_decimals"))?.toInt() ?: 0,
        )
    }

    private fun impactAssetId(impact: JsonElement): String? = FetchJson.string(FetchJson.field(impact, "asset_id"))

    companion object {
        const val MAX_ACCOUNTS = 5
        private val ALGO = AssetFacts("ALGO", 6)
    }
}
