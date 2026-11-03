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

import java.util.Locale
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class TransactionsFetcherTest {
    private fun page(vararg items: String) = """{ "results": [${items.joinToString(",")}] }"""

    // The ALGO impact nets amount + fee for the sender, as the backend sends it.
    private fun pay(id: String, time: Long, sender: String, receiver: String, amount: Long, fee: Long = 1000) =
        """{ "id": "$id", "tx_type": "pay", "round_time": $time, "sender": "$sender", "receiver": "$receiver",
             "amount": "$amount", "fee": "$fee",
             "balance_impacts": [{ "asset_id": 0, "unit_name": "ALGO", "fraction_decimals": 6, "amount": "-${amount + fee}" }] }"""

    private fun fetch(routes: Map<String, String?>, addresses: List<String>, limit: Int = 6): Pair<TransactionsQuote?, StubGet> {
        val stub = StubGet(routes)
        return runBlocking { TransactionsFetcher(stub.get).fetch(addresses, limit, feed("USD"), Locale.US) } to stub
    }

    private fun rows(item: String, account: String = "A") =
        fetch(mapOf("/v1/accounts/$account/transactions/" to page(item)), listOf(account)).first!!.rows

    @Test fun aPaymentShowsTheAmountSentWithoutTheFee() {
        val row = rows(pay("1", 100, "A", "B", 25_000_000)).single()
        assertEquals(TransactionKind.Send, row.kind)
        assertEquals("25 ALGO", row.amount)
    }

    @Test fun theReceiverSeesAReceive() {
        val row = rows(pay("1", 100, "B", "A", 1_500_000)).single()
        assertEquals(TransactionKind.Receive, row.kind)
        assertEquals("1.5 ALGO", row.amount)
    }

    @Test fun algoIgnoresTheBackendsPlaceholderFacts() {
        val item = """{ "id": "1", "tx_type": "pay", "round_time": 100, "sender": "A", "receiver": "B", "amount": "1000000",
            "asset": { "asset_id": 0, "unit_name": "asset(0)", "fraction_decimals": 0 } }"""
        assertEquals("1 ALGO", rows(item).single().amount)
    }

    @Test fun anAssetTransferUsesTheAssetsDecimals() {
        val item = """{ "id": "1", "tx_type": "axfer", "round_time": 100, "sender": "A", "receiver": "B", "amount": "120000000",
            "asset": { "asset_id": 31566704, "unit_name": "USDC", "fraction_decimals": 6 } }"""
        val row = rows(item).single()
        assertEquals(TransactionKind.Send, row.kind)
        assertEquals("120 USDC", row.amount)
    }

    @Test fun aZeroTransferToSelfIsAnOptInAndACloseOutIsAnOptOut() {
        val optIn = """{ "id": "1", "tx_type": "axfer", "round_time": 200, "sender": "A", "receiver": "A", "amount": "0",
            "asset": { "asset_id": 5, "unit_name": "X", "fraction_decimals": 0 } }"""
        val optOut = """{ "id": "2", "tx_type": "axfer", "round_time": 100, "sender": "A", "receiver": "A", "amount": "0",
            "close_to": "C", "asset": { "asset_id": 5, "unit_name": "X", "fraction_decimals": 0 } }"""
        val (q, _) = fetch(mapOf("/v1/accounts/A/transactions/" to page(optIn, optOut)), listOf("A"))
        assertEquals(listOf(TransactionKind.OptIn, TransactionKind.OptOut), q!!.rows.map { it.kind })
        assertTrue(q.rows.all { it.amount == null })
    }

    @Test fun anIncomingZeroTransferIsAReceiveNotAnOptIn() {
        val item = """{ "id": "1", "tx_type": "axfer", "round_time": 100, "sender": "B", "receiver": "A", "amount": "0",
            "asset": { "asset_id": 5, "unit_name": "X", "fraction_decimals": 0 } }"""
        assertEquals(TransactionKind.Receive, rows(item).single().kind)
    }

    @Test fun consensusAndAssetAdminRowsAreNotSends() {
        for (type in listOf("keyreg", "hb", "acfg", "afrz", "stpf")) {
            val item = """{ "id": "1", "tx_type": "$type", "round_time": 100, "sender": "A", "fee": "2000000",
                "balance_impacts": [{ "asset_id": 0, "unit_name": "ALGO", "fraction_decimals": 6, "amount": "-2000000" }] }"""
            val row = rows(item).single()
            assertEquals(type, TransactionKind.Other, row.kind)
            assertNull(type, row.amount)
        }
    }

    @Test fun aCloseOutSendsTheAmountAndTheSweep() {
        val item = """{ "id": "1", "tx_type": "pay", "round_time": 100, "sender": "A", "receiver": "B", "close_to": "C",
            "amount": "1000000", "fee": "1000",
            "balance_impacts": [{ "asset_id": 0, "unit_name": "ALGO", "fraction_decimals": 6, "amount": "-5001000" }] }"""
        assertEquals("5 ALGO", rows(item).single().amount)
    }

    @Test fun aSwapShowsBothUnits() {
        val swap = """{ "id": "1", "tx_type": "appl", "round_time": 100,
            "swap_group_detail": { "asset_in": { "asset_id": 31566704, "unit_name": "USDC" }, "asset_out": { "asset_id": 0 } } }"""
        val row = rows(swap).single()
        assertEquals(TransactionKind.Swap, row.kind)
        assertEquals("USDC → ALGO", row.amount)
    }

    @Test fun aTransferBetweenOwnAccountsAlwaysReadsFromTheFirstAccount() {
        val shared = pay("shared", 300, "A", "B", 1_000_000)
        val routes = mapOf(
            "/v1/accounts/A/transactions/" to page(shared, pay("a", 100, "X", "A", 1_000_000)),
            "/v1/accounts/B/transactions/" to page(shared, pay("b", 200, "X", "B", 1_000_000)),
        )
        repeat(5) {
            val q = fetch(routes, listOf("A", "B"), limit = 2).first!!
            assertEquals(listOf("shared", "b"), q.rows.map { it.id })
            assertEquals(TransactionKind.Send, q.rows.first().kind)
        }
    }

    @Test fun oneFailedAccountStillShowsTheOthers() {
        val (q, _) = fetch(mapOf("/v1/accounts/A/transactions/" to page(pay("a", 100, "X", "A", 1_000_000))), listOf("A", "B"))
        assertEquals(listOf("a"), q!!.rows.map { it.id })
    }

    @Test fun isNullWhenEveryRequestFails() {
        assertNull(fetch(emptyMap(), listOf("A")).first)
    }

    @Test fun asksAtMostFiveAccounts() {
        val (_, stub) = fetch(emptyMap(), (1..8).map { "A$it" })
        assertEquals(TransactionsFetcher.MAX_ACCOUNTS, stub.requests.size)
    }
}
