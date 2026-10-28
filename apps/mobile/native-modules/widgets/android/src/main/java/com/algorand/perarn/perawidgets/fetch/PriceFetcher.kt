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

import com.algorand.perarn.perawidgets.format.QuoteCurrency
import com.algorand.perarn.perawidgets.snapshot.WidgetSnapshot
import java.math.BigDecimal
import java.math.MathContext
import java.time.Instant
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder

object BigDecimalSerializer : KSerializer<BigDecimal> {
    override val descriptor = PrimitiveSerialDescriptor("BigDecimal", PrimitiveKind.STRING)
    override fun serialize(encoder: Encoder, value: BigDecimal) = encoder.encodeString(value.toString())
    override fun deserialize(decoder: Decoder): BigDecimal = BigDecimal(decoder.decodeString())
}

object InstantSerializer : KSerializer<Instant> {
    override val descriptor = PrimitiveSerialDescriptor("Instant", PrimitiveKind.LONG)
    override fun serialize(encoder: Encoder, value: Instant) = encoder.encodeLong(value.toEpochMilli())
    override fun deserialize(decoder: Decoder): Instant = Instant.ofEpochMilli(decoder.decodeLong())
}

object QuoteCurrencySerializer : KSerializer<QuoteCurrency> {
    override val descriptor = PrimitiveSerialDescriptor("QuoteCurrency", PrimitiveKind.STRING)
    override fun serialize(encoder: Encoder, value: QuoteCurrency) = encoder.encodeString(value.code)
    override fun deserialize(decoder: Decoder): QuoteCurrency {
        val code = decoder.decodeString()
        return if (code == QuoteCurrency.Algo.code) QuoteCurrency.Algo else QuoteCurrency.Fiat(code)
    }
}

@Serializable
data class PriceQuote(
    val assetId: String,
    val unitName: String,
    // Units of `quote` per 1 whole unit of the asset.
    @Serializable(with = BigDecimalSerializer::class) val price: BigDecimal,
    // Fractional change over 24h (0.032 = +3.2%); null when the backend has no prior value.
    val change24h: Double?,
    // Oldest first, in `quote`. Empty when the chart call fails.
    val chart: List<Double>,
    @Serializable(with = QuoteCurrencySerializer::class) val quote: QuoteCurrency,
    @Serializable(with = InstantSerializer::class) val fetchedAt: Instant,
)

class PriceFetcher(private val get: HttpGet) {
    // The picker only offers verified assets, but a tier can be downgraded after the pick, so every fetch re-checks.
    private val trustedTiers = setOf("verified", "trusted")

    // Null on any failure, and for an asset that is no longer verified. `period` is the backend value.
    suspend fun fetch(
        feed: WidgetSnapshot.PriceFeed,
        assetId: String,
        quote: QuoteCurrency,
        period: String,
        now: Instant = Instant.now(),
    ): PriceQuote? = coroutineScope {
        val backend = feed.backendUrl
        val apiKey = feed.apiKey.orEmpty()
        val isNative = assetId == NATIVE_ASSET_ID

        val asset = async { getJson(backend, "v1/public/assets/$assetId/", apiKey) }
        val factor = async { usdFactor(backend, quote, apiKey) }
        val chart = async { getJson(backend, "v1/assets/price-chart/?asset_id=$assetId&period=$period", apiKey) }

        val assetJson = asset.await() ?: return@coroutineScope null
        val tier = FetchJson.string(FetchJson.field(assetJson, "verification_tier")).orEmpty()
        if (!isNative && tier !in trustedTiers) return@coroutineScope null
        val usd = FetchJson.decimal(FetchJson.field(assetJson, "usd_value")) ?: return@coroutineScope null
        val rate = factor.await() ?: return@coroutineScope null

        val previous = FetchJson.decimal(FetchJson.field(assetJson, "usd_value_24_hour_ago"))
        val change = if (previous != null && previous.signum() != 0) {
            (usd - previous).divide(previous, MathContext.DECIMAL128).toDouble()
        } else {
            null
        }
        val rateValue = rate.toDouble()
        val series = prices(chart.await()).map { it * rateValue }

        PriceQuote(
            assetId = assetId,
            unitName = if (isNative) "ALGO" else unitName(assetJson) ?: assetId,
            price = usd.multiply(rate),
            change24h = change,
            chart = series,
            quote = quote,
            fetchedAt = now,
        )
    }

    private fun unitName(asset: kotlinx.serialization.json.JsonElement): String? =
        FetchJson.string(FetchJson.field(asset, "unit_name")) ?: FetchJson.string(FetchJson.field(asset, "name"))

    // Chart is all-or-nothing, as the iOS decoder is: one malformed point drops the series.
    private fun prices(chart: kotlinx.serialization.json.JsonElement?): List<Double> {
        val points = FetchJson.array(chart) ?: return emptyList()
        val values = points.map { FetchJson.decimal(FetchJson.field(it, "price"))?.toDouble() }
        return if (values.any { it == null }) emptyList() else values.filterNotNull()
    }

    private suspend fun usdFactor(backend: String?, quote: QuoteCurrency, apiKey: String): BigDecimal? =
        when (quote) {
            is QuoteCurrency.Fiat -> usdRate(backend, quote.code, apiKey)
            QuoteCurrency.Algo -> {
                val algo = getJson(backend, "v1/public/assets/$NATIVE_ASSET_ID/", apiKey)
                val algoUsd = FetchJson.decimal(FetchJson.field(algo, "usd_value"))
                if (algoUsd == null || algoUsd.signum() == 0) null else BigDecimal.ONE.divide(algoUsd, MathContext.DECIMAL128)
            }
        }

    // 1 for USD; otherwise the backend's usd_value is how many units of that currency one USD buys.
    internal suspend fun usdRate(backend: String?, code: String, apiKey: String): BigDecimal? {
        if (code == "USD") return BigDecimal.ONE
        return FetchJson.decimal(FetchJson.field(getJson(backend, "v1/currencies/$code/", apiKey), "usd_value"))
    }

    internal suspend fun getJson(backend: String?, path: String, apiKey: String): kotlinx.serialization.json.JsonElement? {
        val url = endpoint(backend, path) ?: return null
        return FetchJson.parse(withContext(Dispatchers.IO) { get(url, apiKey) })
    }

    companion object {
        const val NATIVE_ASSET_ID = "0"
    }
}
