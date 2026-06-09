package com.algorand.perarn.peraagegate

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.android.play.agesignals.AgeSignalsManagerFactory
import com.google.android.play.agesignals.AgeSignalsRequest

class PeraAgeGateModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "PeraAgeGate"

    @ReactMethod
    fun getDeviceCapability(promise: Promise) {
        // Play Age Signals is available on API 23+; treat as platform-capable.
        promise.resolve("platform")
    }

    @ReactMethod
    fun requestAgeRange(minimumAge: Int, promise: Promise) {
        try {
            val manager = AgeSignalsManagerFactory.create(reactApplicationContext)
            manager.checkAgeSignals(AgeSignalsRequest.builder().build())
                .addOnSuccessListener { result ->
                    val map = Arguments.createMap()
                    map.putString("userStatus", result.userStatus()?.toString())
                    if (result.ageLower() != null) {
                        map.putInt("ageLower", result.ageLower()!!)
                    } else {
                        map.putNull("ageLower")
                    }
                    if (result.ageUpper() != null) {
                        map.putInt("ageUpper", result.ageUpper()!!)
                    } else {
                        map.putNull("ageUpper")
                    }
                    promise.resolve(map)
                }
                .addOnFailureListener {
                    promise.resolve(unknownResult())
                }
        } catch (t: Throwable) {
            promise.resolve(unknownResult())
        }
    }

    private fun unknownResult() = Arguments.createMap().apply {
        putString("userStatus", "UNKNOWN")
        putNull("ageLower")
        putNull("ageUpper")
    }
}
