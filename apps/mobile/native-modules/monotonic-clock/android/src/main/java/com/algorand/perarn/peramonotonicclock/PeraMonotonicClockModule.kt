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

package com.algorand.perarn.peramonotonicclock

import android.os.SystemClock
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Payload contract consumed by RNMonotonicClockService: `now()` returns
 * `{ bootId: string, elapsedMs: number }`. `elapsedRealtime` keeps counting in
 * deep sleep, unlike `uptimeMillis`, so a lockout served with the screen off
 * still elapses.
 */
class PeraMonotonicClockModule : Module() {
  // Computed once per process: it shifts when the wall clock is stepped, and a
  // mid-process shift would restart a running lockout.
  private val bootTimeFallback by lazy {
    "boottime:${(System.currentTimeMillis() - SystemClock.elapsedRealtime()) / 1000}"
  }

  override fun definition() = ModuleDefinition {
    Name("PeraMonotonicClock")

    Function("now") {
      mapOf(
        "bootId" to bootId(),
        "elapsedMs" to SystemClock.elapsedRealtime().toDouble(),
      )
    }
  }

  private fun bootId(): String {
    val resolver = appContext.reactContext?.contentResolver ?: return bootTimeFallback
    val count = Settings.Global.getInt(resolver, Settings.Global.BOOT_COUNT, -1)
    return if (count >= 0) count.toString() else bootTimeFallback
  }
}
