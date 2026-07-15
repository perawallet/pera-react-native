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

package com.algorand.perarn.perabluetooth

import android.app.Activity
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.content.Context
import android.content.Intent
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Surfaces the Android system "An app wants to turn on Bluetooth" dialog via
 * [BluetoothAdapter.ACTION_REQUEST_ENABLE]. ble-plx's `enable()` was removed in
 * SDK 33+, so we fire the intent ourselves and resolve the stored promise from
 * the activity result.
 */
class PeraBluetoothModule : Module() {
  private var pendingPromise: Promise? = null

  private fun adapter(): BluetoothAdapter? =
    (appContext.reactContext?.getSystemService(Context.BLUETOOTH_SERVICE)
      as? BluetoothManager)?.adapter

  override fun definition() = ModuleDefinition {
    Name("PeraBluetooth")

    AsyncFunction("requestEnable") { promise: Promise ->
      val adapter = adapter()
      if (adapter == null) {
        promise.resolve(false)
        return@AsyncFunction
      }
      if (adapter.isEnabled) {
        promise.resolve(true)
        return@AsyncFunction
      }
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.resolve(false)
        return@AsyncFunction
      }
      // Replace any stale pending request rather than leaking it.
      pendingPromise?.resolve(false)
      pendingPromise = promise
      try {
        activity.startActivityForResult(
          Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE),
          REQUEST_ENABLE_BT,
        )
      } catch (t: Throwable) {
        // Missing BLUETOOTH_CONNECT (API 31+) or no handling activity —
        // resolve gracefully so JS falls back to its toast.
        pendingPromise = null
        promise.resolve(false)
      }
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode != REQUEST_ENABLE_BT) return@OnActivityResult
      val promise = pendingPromise ?: return@OnActivityResult
      pendingPromise = null
      promise.resolve(payload.resultCode == Activity.RESULT_OK)
    }
  }

  private companion object {
    const val REQUEST_ENABLE_BT = 0xB7E
  }
}
