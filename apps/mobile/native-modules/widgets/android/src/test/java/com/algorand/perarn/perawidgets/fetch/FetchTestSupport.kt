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

fun feed(currency: String?, backend: String? = "https://api.test") =
    WidgetSnapshot.PriceFeed(backendUrl = backend, apiKey = "test-key", currencyCode = currency)

// Routes by URL path; an unrouted path or a null body behaves as a failed request.
class StubGet(private val routes: Map<String, String?>) {
    val requests = mutableListOf<Pair<String, String>>()

    val get: HttpGet = { url, apiKey ->
        synchronized(requests) { requests.add(url to apiKey) }
        routes[url.removePrefix("https://api.test").substringBefore("?")]
    }
}
