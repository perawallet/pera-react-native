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

package com.algorand.perarn.peragoogleauth

import android.app.Activity
import com.google.android.gms.auth.api.identity.AuthorizationRequest
import com.google.android.gms.auth.api.identity.ClearTokenRequest
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.common.api.Scope
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Matches the code JS already maps to GooglePlayServicesUnavailableError.
private const val PLAY_SERVICES_NOT_AVAILABLE = "PLAY_SERVICES_NOT_AVAILABLE"
private const val ERR_GOOGLE_AUTH = "ERR_GOOGLE_AUTH"
private const val CONSENT_REQUEST_CODE = 0x6047

class PeraGoogleAuthModule : Module() {
  // The consent screen in flight, settled from OnActivityResult.
  private var pendingConsent: Pair<String, Promise>? = null

  override fun definition() = ModuleDefinition {
    Name("PeraGoogleAuth")

    // Resolves an access token for `scope`, or null when the user backs out.
    // Shows UI only when the scope has not been granted yet.
    AsyncFunction("authorize") { scope: String, promise: Promise ->
      val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()
      // Offers the Play Services update or enable dialog when that is all
      // that's missing.
      GoogleApiAvailability.getInstance()
        .makeGooglePlayServicesAvailable(activity)
        .addOnSuccessListener { requestAuthorization(activity, scope, promise) }
        .addOnFailureListener {
          promise.reject(PLAY_SERVICES_NOT_AVAILABLE, it.message, it)
        }
    }

    // Drops a token from the device cache so the next authorize mints a new one.
    AsyncFunction("clearToken") { token: String, promise: Promise ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      Identity.getAuthorizationClient(context)
        .clearToken(ClearTokenRequest.builder().setToken(token).build())
        .addOnSuccessListener { promise.resolve(null) }
        .addOnFailureListener { promise.reject(ERR_GOOGLE_AUTH, it.message, it) }
    }

    OnActivityResult { activity, payload ->
      if (payload.requestCode != CONSENT_REQUEST_CODE) return@OnActivityResult
      val (scope, promise) = pendingConsent ?: return@OnActivityResult
      pendingConsent = null
      if (payload.resultCode != Activity.RESULT_OK) {
        promise.resolve(null)
        return@OnActivityResult
      }
      try {
        val result = Identity.getAuthorizationClient(activity)
          .getAuthorizationResultFromIntent(payload.data)
        promise.resolve(if (scope in result.grantedScopes) result.accessToken else null)
      } catch (error: Exception) {
        promise.reject(ERR_GOOGLE_AUTH, error.message, error)
      }
    }
  }

  private fun requestAuthorization(activity: Activity, scope: String, promise: Promise) {
    val request = AuthorizationRequest.builder()
      .setRequestedScopes(listOf(Scope(scope)))
      .build()
    Identity.getAuthorizationClient(activity)
      .authorize(request)
      .addOnSuccessListener { result ->
        val consent = result.pendingIntent
        if (!result.hasResolution() || consent == null) {
          promise.resolve(result.accessToken)
          return@addOnSuccessListener
        }
        // A consent screen left open by an earlier call is abandoned.
        pendingConsent?.second?.resolve(null)
        pendingConsent = scope to promise
        activity.startIntentSenderForResult(
          consent.intentSender, CONSENT_REQUEST_CODE, null, 0, 0, 0,
        )
      }
      .addOnFailureListener { promise.reject(ERR_GOOGLE_AUTH, it.message, it) }
  }
}
