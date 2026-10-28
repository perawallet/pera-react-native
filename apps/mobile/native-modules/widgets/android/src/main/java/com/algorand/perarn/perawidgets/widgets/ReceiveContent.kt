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

import com.algorand.perarn.perawidgets.config.ReceiveOptions
import com.algorand.perarn.perawidgets.config.resolveReceiveTarget
import com.algorand.perarn.perawidgets.snapshot.WidgetSnapshot

data class ReceiveContent(val label: String, val payload: String, val tapUrl: String)

private const val ACCOUNT_URL = "perawallet://app/account-detail/"

// Null (logo only) in privacy mode, when the app shares no account, and for a target without a payment URI.
fun receiveContent(snapshot: WidgetSnapshot?, options: ReceiveOptions): ReceiveContent? {
    val target = resolveReceiveTarget(options, snapshot) ?: return null
    val address = target.address ?: return null
    val payload = target.paymentUri?.takeIf { it.isNotEmpty() } ?: return null
    return ReceiveContent(target.name.orEmpty(), payload, accountUrl(address, target.chain))
}

// Matches URLComponents: space is %20, and ":" and "/" are legal in a query.
fun accountUrl(address: String, chain: String?): String {
    val query = listOfNotNull("address=${encode(address)}", chain?.let { "chain=${encode(it)}" })
    return "$ACCOUNT_URL?${query.joinToString("&")}"
}

private fun encode(value: String): String = buildString {
    for (byte in value.toByteArray(Charsets.UTF_8)) {
        val c = (byte.toInt() and 0xFF).toChar()
        if (c in 'A'..'Z' || c in 'a'..'z' || c in '0'..'9' || c in "-._~:/") append(c) else append("%%%02X".format(byte))
    }
}
