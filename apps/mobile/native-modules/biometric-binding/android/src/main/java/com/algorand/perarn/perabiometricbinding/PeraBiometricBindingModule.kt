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

package com.algorand.perarn.perabiometricbinding

import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import androidx.biometric.BiometricManager
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import android.security.keystore.UserNotAuthenticatedException
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey

private const val KEYSTORE = "AndroidKeyStore"
private const val ALIAS = "pera.biometric.enrollment"
private const val TRANSFORMATION = "AES/GCM/NoPadding"

/**
 * Detects changes to the enrolled biometric set, so a fingerprint enrolled
 * *after* the user opted in cannot inherit that opt-in.
 *
 * Android exposes no "enrollment changed" signal, so the AndroidKeyStore itself
 * carries the invalidation: `setInvalidatedByBiometricEnrollment` makes the OS
 * destroy this key when a biometric is enrolled or all of them are removed, and
 * `Cipher.init` then throws `KeyPermanentlyInvalidatedException`. The key holds
 * nothing and is never used to encrypt anything — its existence *is* the
 * binding.
 *
 * `Cipher.init` is deliberate: it surfaces invalidation without any user
 * interaction, whereas actually using the key would require a BiometricPrompt.
 * `UserNotAuthenticatedException` therefore means the key is intact and merely
 * unauthenticated, which is a valid binding.
 *
 * Status contract consumed by RNBiometricsService: 'valid' | 'changed' |
 * 'absent' | 'unavailable', where only 'changed' affirmatively reports that the
 * set was modified.
 */
class PeraBiometricBindingModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PeraBiometricBinding")

    AsyncFunction("createBinding") { promise: Promise ->
      try {
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE)
        generator.init(keySpec())
        generator.generateKey()
        promise.resolve(true)
      } catch (t: Throwable) {
        // No strong biometric enrolled, no secure lock screen, or an OEM
        // keystore refusal. The caller re-attempts on the next reconcile.
        promise.resolve(false)
      }
    }

    AsyncFunction("checkBinding") { promise: Promise ->
      promise.resolve(checkBinding())
    }

    AsyncFunction("clearBinding") { promise: Promise ->
      try {
        loadKeyStore().deleteEntry(ALIAS)
      } catch (t: Throwable) {
        // Nothing to delete, or the keystore is unreadable; either way the
        // caller has already dropped the secret this guarded.
      }
      promise.resolve(null)
    }

    // The raw `canAuthenticate` code, which expo's `isEnrolledAsync` throws away
    // by collapsing every non-SUCCESS result into `false`. `NONE_ENROLLED` is
    // the only one the user has to act on; `HW_UNAVAILABLE` is the lockout and
    // clears itself.
    AsyncFunction("getAvailability") { promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.resolve("unknown")
        return@AsyncFunction
      }
      val status =
        try {
          BiometricManager.from(context)
            .canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK)
        } catch (t: Throwable) {
          promise.resolve("unknown")
          return@AsyncFunction
        }

      promise.resolve(
        when (status) {
          BiometricManager.BIOMETRIC_SUCCESS -> "available"
          BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> "none-enrolled"
          // A pending security patch also needs the user to act, but the fix is
          // a system update rather than an enrollment, and the copy would be
          // wrong. Treated as temporary so nothing misleading is shown.
          BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED -> "unavailable"
          BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE -> "unavailable"
          BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE -> "unavailable"
          else -> "unknown"
        },
      )
    }
  }

  private fun checkBinding(): String {
    val key =
      try {
        loadKeyStore().getKey(ALIAS, null) as? SecretKey
      } catch (t: Throwable) {
        return "unavailable"
      } ?: return "absent"

    return try {
      Cipher.getInstance(TRANSFORMATION).init(Cipher.ENCRYPT_MODE, key)
      "valid"
    } catch (e: KeyPermanentlyInvalidatedException) {
      "changed"
    } catch (e: UserNotAuthenticatedException) {
      "valid"
    } catch (t: Throwable) {
      "unavailable"
    }
  }

  private fun keySpec(): KeyGenParameterSpec {
    val builder =
      KeyGenParameterSpec.Builder(
          ALIAS,
          KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
        )
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setUserAuthenticationRequired(true)
        .setInvalidatedByBiometricEnrollment(true)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      // 0s validity = authentication required for every use, which is what
      // binds the key to the biometric set rather than to a time window.
      builder.setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG)
    } else {
      @Suppress("DEPRECATION")
      builder.setUserAuthenticationValidityDurationSeconds(-1)
    }

    return builder.build()
  }

  private fun loadKeyStore(): KeyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }
}
