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

import java.math.BigDecimal
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PortfolioFetcherTest {
    private val history = """
        { "results": [
            { "usd_value": "100", "algo_value": "500" },
            { "usd_value": 120, "algo_value": 600 }
        ] }
    """.trimIndent()

    private fun fetch(routes: Map<String, String?>, addresses: List<String>, period: String = "one-week", currency: String = "EUR"): Pair<PortfolioQuote?, StubGet> {
        val stub = StubGet(routes)
        return runBlocking { PortfolioFetcher(stub.get).fetch(addresses, period, feed(currency)) } to stub
    }

    @Test fun usesTheLastPointAsTheCurrentValue() {
        val (q, _) = fetch(mapOf("/v1/wallet/wealth/" to history, "/v1/currencies/EUR/" to "{ \"usd_value\": \"0.5\" }"), listOf("A"))
        q!!
        assertEquals(0, BigDecimal(600).compareTo(q.algo))
        assertEquals(0, BigDecimal(60).compareTo(q.fiat))
        assertEquals(listOf(500.0, 600.0), q.chart)
        assertEquals(0.2, q.change!!, 1e-9)
        assertEquals("EUR", q.currencyCode)
    }

    @Test fun keepsTheAlgoValueWhenTheRateIsUnknown() {
        val (q, _) = fetch(mapOf("/v1/wallet/wealth/" to history), listOf("A"))
        assertEquals(0, BigDecimal(600).compareTo(q!!.algo))
        assertNull(q.fiat)
    }

    @Test fun sendsCommaJoinedAddressesAndThePeriod() {
        val (_, stub) = fetch(mapOf("/v1/wallet/wealth/" to history), listOf("A", "B"), period = "one-day")
        val url = stub.requests.first { it.first.contains("/v1/wallet/wealth/") }.first
        assertTrue(url, url.contains("account_addresses=A,B"))
        assertTrue(url, url.contains("period=one-day"))
    }

    @Test fun makesNoRequestWithoutAddresses() {
        val (q, stub) = fetch(emptyMap(), emptyList())
        assertNull(q)
        assertTrue(stub.requests.isEmpty())
    }

    @Test fun failsWhenTheHistoryIsEmpty() {
        val (q, _) = fetch(mapOf("/v1/wallet/wealth/" to "{ \"results\": [] }"), listOf("A"))
        assertNull(q)
    }

    @Test fun anyFailureIsNull() {
        val (q, _) = fetch(emptyMap(), listOf("A"))
        assertNull(q)
    }

    @Test fun noChangeWhenTheChartStartsAtZero() {
        val zero = "{ \"results\": [ { \"algo_value\": \"0\" }, { \"algo_value\": \"5\" } ] }"
        val (q, _) = fetch(mapOf("/v1/wallet/wealth/" to zero, "/v1/currencies/EUR/" to "{ \"usd_value\": \"1\" }"), listOf("A"))
        assertNull(q!!.change)
    }
}
