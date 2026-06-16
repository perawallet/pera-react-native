/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Surfaces the Android system "An app wants to turn on Bluetooth" dialog via
 * [BluetoothAdapter.ACTION_REQUEST_ENABLE]. Unlike iOS, Android can actually
 * enable the adapter on user consent. ble-plx's old `enable()` was removed in
 * SDK 33+, so we fire the intent ourselves.
 */
class PeraBluetoothModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    private var pendingPromise: Promise? = null

    init {
        reactContext.addActivityEventListener(this)
    }

    override fun getName() = "PeraBluetooth"

    private fun adapter(): BluetoothAdapter? =
        (reactApplicationContext.getSystemService(Context.BLUETOOTH_SERVICE)
            as? BluetoothManager)?.adapter

    @ReactMethod
    fun requestEnable(promise: Promise) {
        val adapter = adapter()
        if (adapter == null) {
            // No Bluetooth hardware — nothing to enable.
            promise.resolve(false)
            return
        }
        if (adapter.isEnabled) {
            promise.resolve(true)
            return
        }

        val activity = currentActivity
        if (activity == null) {
            promise.resolve(false)
            return
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
            // resolve gracefully so the JS layer falls back to its toast.
            pendingPromise = null
            promise.resolve(false)
        }
    }

    override fun onActivityResult(
        activity: Activity?,
        requestCode: Int,
        resultCode: Int,
        data: Intent?,
    ) {
        if (requestCode != REQUEST_ENABLE_BT) return
        val promise = pendingPromise ?: return
        pendingPromise = null
        promise.resolve(resultCode == Activity.RESULT_OK)
    }

    override fun onNewIntent(intent: Intent?) {
        // No-op: we only care about the enable activity result.
    }

    private companion object {
        const val REQUEST_ENABLE_BT = 0xB7E
    }
}
