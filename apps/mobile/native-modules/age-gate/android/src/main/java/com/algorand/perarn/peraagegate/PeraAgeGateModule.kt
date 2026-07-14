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

package com.algorand.perarn.peraagegate

import com.google.android.play.agesignals.AgeSignalsManagerFactory
import com.google.android.play.agesignals.AgeSignalsRequest
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Surfaces the Google Play Age Signals API. Payload contract consumed by
 * RNAgeGateService: `{ userStatus?: string, ageLower?: number|null,
 * ageUpper?: number|null }` — failures resolve to the UNKNOWN payload rather
 * than rejecting, so the JS side treats every outcome as a mappable result.
 */
class PeraAgeGateModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PeraAgeGate")

    AsyncFunction("getDeviceCapability") { promise: Promise ->
      // Play Age Signals is available on API 23+; treat as platform-capable.
      promise.resolve("platform")
    }

    // minimumAge is part of the cross-platform contract; the Play Age Signals
    // request doesn't take it (the gate is interpreted JS-side).
    AsyncFunction("requestAgeRange") { _: Int, promise: Promise ->
      try {
        val context = appContext.reactContext
        if (context == null) {
          promise.resolve(unknownResult())
          return@AsyncFunction
        }
        val manager = AgeSignalsManagerFactory.create(context)
        manager.checkAgeSignals(AgeSignalsRequest.builder().build())
          .addOnSuccessListener { result ->
            promise.resolve(
              mapOf(
                "userStatus" to result.userStatus()?.toString(),
                "ageLower" to result.ageLower(),
                "ageUpper" to result.ageUpper(),
              ),
            )
          }
          .addOnFailureListener {
            promise.resolve(unknownResult())
          }
      } catch (t: Throwable) {
        promise.resolve(unknownResult())
      }
    }
  }

  private fun unknownResult() = mapOf(
    "userStatus" to "UNKNOWN",
    "ageLower" to null,
    "ageUpper" to null,
  )
}
