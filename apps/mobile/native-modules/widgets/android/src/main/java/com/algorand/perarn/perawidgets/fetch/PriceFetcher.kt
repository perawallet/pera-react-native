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
import com.algorand.perarn.perawidgets.snapshot.NATIVE_ASSET_ID
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

sealed interface PriceFetch {
    data class Fetched(val quote: PriceQuote) : PriceFetch

    // The asset is no longer verified or trusted: its cached price must go, not stay as the last good one.
    data object Untrusted : PriceFetch

    data object Failed : PriceFetch
}

class PriceFetcher(private val get: HttpGet) {
    // The picker only offers verified assets, but a tier can be downgraded after the pick, so every fetch re-checks.
    private val trustedTiers = setOf("verified", "trusted")

    // What one USD is worth in the quote, now and 24h ago, and the quote's own chart when it moves against USD.
    private class Reference(val perUsd: BigDecimal, val perUsd24hAgo: BigDecimal?, val chartPerUsd: List<Double>?)

    // `period` is the backend value.
    suspend fun fetch(
        feed: WidgetSnapshot.PriceFeed,
        assetId: String,
        quote: QuoteCurrency,
        period: String,
        now: Instant = Instant.now(),
    ): PriceFetch = coroutineScope {
        val backend = feed.backendUrl
        val apiKey = feed.apiKey.orEmpty()
        val isNative = assetId == NATIVE_ASSET_ID

        val asset = async { getJson(backend, "v1/public/assets/$assetId/", apiKey) }
        val reference = async { reference(backend, quote, period, apiKey) }
        val chart = async { getJson(backend, chartPath(assetId, period), apiKey) }

        val assetJson = asset.await() ?: return@coroutineScope PriceFetch.Failed
        val tier = FetchJson.string(FetchJson.field(assetJson, "verification_tier")).orEmpty()
        if (!isNative && tier !in trustedTiers) return@coroutineScope PriceFetch.Untrusted
        val usd = FetchJson.decimal(FetchJson.field(assetJson, "usd_value")) ?: return@coroutineScope PriceFetch.Failed
        val ref = reference.await() ?: return@coroutineScope PriceFetch.Failed

        val previous = FetchJson.decimal(FetchJson.field(assetJson, "usd_value_24_hour_ago"))
        PriceFetch.Fetched(
            PriceQuote(
                assetId = assetId,
                unitName = if (isNative) "ALGO" else unitName(assetJson) ?: assetId,
                price = usd.multiply(ref.perUsd),
                change24h = change(usd, previous, ref),
                chart = chartIn(prices(chart.await()), ref),
                quote = quote,
                fetchedAt = now,
            ),
        )
    }

    // In ALGO the asset moves against a moving unit: (now in ALGO) / (24h ago in ALGO) - 1.
    private fun change(usd: BigDecimal, previousUsd: BigDecimal?, ref: Reference): Double? {
        if (previousUsd == null || previousUsd.signum() == 0) return null
        val then = ref.perUsd24hAgo ?: return null
        if (then.signum() == 0) return null
        val nowInQuote = usd.multiply(ref.perUsd)
        val thenInQuote = previousUsd.multiply(then)
        return nowInQuote.divide(thenInQuote, MathContext.DECIMAL128).subtract(BigDecimal.ONE).toDouble()
    }

    // A fiat rate is one value for the period; an ALGO quote divides point by point, and only when both series line up.
    private fun chartIn(usdChart: List<Double>, ref: Reference): List<Double> {
        val perUsd = ref.chartPerUsd ?: return usdChart.map { it * ref.perUsd.toDouble() }
        if (usdChart.isEmpty() || usdChart.size != perUsd.size) return emptyList()
        return usdChart.zip(perUsd) { price, rate -> price * rate }
    }

    private fun unitName(asset: kotlinx.serialization.json.JsonElement): String? =
        FetchJson.string(FetchJson.field(asset, "unit_name")) ?: FetchJson.string(FetchJson.field(asset, "name"))

    // Chart is all-or-nothing, as the iOS decoder is: one malformed point drops the series.
    private fun prices(chart: kotlinx.serialization.json.JsonElement?): List<Double> {
        val points = FetchJson.array(chart) ?: return emptyList()
        val values = points.map { FetchJson.decimal(FetchJson.field(it, "price"))?.toDouble() }
        return if (values.any { it == null }) emptyList() else values.filterNotNull()
    }

    private fun chartPath(assetId: String, period: String) = "v1/assets/price-chart/?asset_id=$assetId&period=$period"

    private suspend fun reference(backend: String?, quote: QuoteCurrency, period: String, apiKey: String): Reference? =
        when (quote) {
            // The backend has no rate history, so a fiat quote's change and chart are the asset's USD ones.
            is QuoteCurrency.Fiat -> usdRate(backend, quote.code, apiKey)?.let { Reference(it, it, null) }
            QuoteCurrency.Algo -> coroutineScope {
                val algoChart = async { getJson(backend, chartPath(NATIVE_ASSET_ID, period), apiKey) }
                val algo = getJson(backend, "v1/public/assets/$NATIVE_ASSET_ID/", apiKey)
                val algoUsd = FetchJson.decimal(FetchJson.field(algo, "usd_value"))
                if (algoUsd == null || algoUsd.signum() == 0) {
                    algoChart.cancel()
                    return@coroutineScope null
                }
                val algoUsd24hAgo = FetchJson.decimal(FetchJson.field(algo, "usd_value_24_hour_ago"))?.takeIf { it.signum() != 0 }
                val chartAlgoUsd = prices(algoChart.await())
                Reference(
                    perUsd = BigDecimal.ONE.divide(algoUsd, MathContext.DECIMAL128),
                    perUsd24hAgo = algoUsd24hAgo?.let { BigDecimal.ONE.divide(it, MathContext.DECIMAL128) },
                    chartPerUsd = if (chartAlgoUsd.any { it == 0.0 }) emptyList() else chartAlgoUsd.map { 1.0 / it },
                )
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
}
