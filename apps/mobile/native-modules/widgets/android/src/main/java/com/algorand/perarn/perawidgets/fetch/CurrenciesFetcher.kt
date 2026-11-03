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

import com.algorand.perarn.perawidgets.snapshot.WidgetSnapshot

data class FetchedCurrency(val code: String, val name: String?)

class CurrenciesFetcher(get: HttpGet) {
    private val prices = PriceFetcher(get)

    // The list behind the app's currency picker; null when it can't be loaded.
    suspend fun fetch(feed: WidgetSnapshot.PriceFeed): List<FetchedCurrency>? {
        val json = prices.getJson(feed.backendUrl, "v1/currencies/", feed.apiKey.orEmpty()) ?: return null
        val items = FetchJson.array(json) ?: FetchJson.array(FetchJson.field(json, "results")) ?: return null
        return items.mapNotNull { item ->
            FetchJson.string(FetchJson.field(item, "currency_id"))?.let { FetchedCurrency(it, FetchJson.string(FetchJson.field(item, "name"))) }
        }
    }
}
