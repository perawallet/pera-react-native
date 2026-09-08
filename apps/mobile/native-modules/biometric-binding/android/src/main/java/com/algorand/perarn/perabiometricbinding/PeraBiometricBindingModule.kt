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
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import android.security.keystore.StrongBoxUnavailableException
import android.security.keystore.UserNotAuthenticatedException
import android.util.Base64
import android.util.Log
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.security.KeyFactory
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.MessageDigest
import java.security.PublicKey
import java.security.SecureRandom
import java.security.spec.MGF1ParameterSpec
import java.security.spec.X509EncodedKeySpec
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.OAEPParameterSpec
import javax.crypto.spec.PSource

private const val KEYSTORE = "AndroidKeyStore"
private const val ALIAS = "pera.biometric.enrollment"
private const val UNLOCK_ALIAS = "pera.biometric.unlock"
private const val TRANSFORMATION = "AES/GCM/NoPadding"
private const val RSA_TRANSFORMATION = "RSA/ECB/OAEPWithSHA-256AndMGF1Padding"
private const val LOG_TAG = "PeraBiometricBinding"

/**
 * Binds biometric unlock to the OS rather than to a stored boolean, and detects
 * changes to the enrolled biometric set so a fingerprint enrolled *after* the
 * user opted in cannot inherit that opt-in.
 *
 * Two keys, created and destroyed as one unit so the probe can never disagree
 * with the key it stands for:
 *
 * - An RSA pair at `pera.biometric.unlock` that actually holds the secret. The
 *   token the wallet needs is wrapped to its public half and can only be
 *   unwrapped by a BiometricPrompt-authorised `Cipher`, so the TEE — not
 *   JavaScript — decides whether the user is in.
 * - An AES canary at `pera.biometric.enrollment` that holds nothing; its
 *   existence *is* the enrollment binding. It stays because it is the only
 *   non-interactive invalidation probe available: for AES the keystore
 *   operation begins at `Cipher.init`, which raises
 *   `KeyPermanentlyInvalidatedException` with no user present, whereas RSA
 *   defers the authentication check to `doFinal` and so cannot be probed at all
 *   without a ceremony. `UserNotAuthenticatedException` therefore means the key
 *   is intact and merely unauthenticated, which is a valid binding.
 *
 * `setInvalidatedByBiometricEnrollment` is what makes the OS invalidate both
 * when a biometric is enrolled or all of them are removed.
 *
 * Status contract consumed by RNBiometricsService: 'valid' | 'changed' |
 * 'absent' | 'unavailable', where only 'changed' affirmatively reports that the
 * set was modified. Unwrap failures reject with one of 'invalidated',
 * 'no-binding', 'user-cancel', 'system-cancel', 'lockout', 'unavailable',
 * 'failed'; anything else degrades to 'unknown' in JavaScript.
 */
class PeraBiometricBindingModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PeraBiometricBinding")

    // Deliberately ceremony-free: the public half does the wrapping, and the
    // legacy migration path arms with no user present.
    AsyncFunction("armBinding") { promise: Promise ->
      try {
        // Delete first so this is idempotent: generating over a live alias
        // fails, and the service layer only logs that.
        clearKeys()
        val generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_RSA, KEYSTORE)
        try {
          generator.initialize(unlockKeySpec(strongBox = true))
          generator.generateKeyPair()
        } catch (e: StrongBoxUnavailableException) {
          // Declared available on some devices that then refuse it.
          Log.w(LOG_TAG, "StrongBox was refused; falling back to the TEE", e)
          generator.initialize(unlockKeySpec(strongBox = false))
          generator.generateKeyPair()
        }
        createCanaryKey()

        val token = ByteArray(32).also { SecureRandom().nextBytes(it) }
        try {
          val cipher = Cipher.getInstance(RSA_TRANSFORMATION)
          cipher.init(Cipher.ENCRYPT_MODE, detachedPublicKey(), oaepSpec())
          val ciphertext = cipher.doFinal(token)
          val digest =
            MessageDigest.getInstance("SHA-256").digest(token).joinToString("") { "%02x".format(it) }
          promise.resolve(
            mapOf(
              "blob" to Base64.encodeToString(ciphertext, Base64.NO_WRAP),
              "tokenHash" to digest,
            ),
          )
        } finally {
          token.fill(0)
        }
      } catch (t: Throwable) {
        // Device QA is the only verification this has, and a null return reads
        // the same in JS whatever caused it, so the reason has to be logged
        // here or it is lost: no strong biometric enrolled, no secure lock
        // screen, or an OEM keystore refusal.
        Log.w(LOG_TAG, "arming the binding failed", t)
        // A key with no blob to unwrap is orphaned: the reconcile early-returns
        // when there is no blob, so nothing would ever clear it.
        clearKeys()
        promise.resolve(null)
      }
    }

    AsyncFunction("unwrapToken") { blob: String, prompt: Map<String, String>, promise: Promise ->
      try {
        val entry = loadKeyStore().getEntry(UNLOCK_ALIAS, null) as? KeyStore.PrivateKeyEntry
        if (entry == null) {
          promise.reject(CodedException("no-binding", "no key", null))
          return@AsyncFunction
        }
        val cipher = Cipher.getInstance(RSA_TRANSFORMATION)
        cipher.init(Cipher.DECRYPT_MODE, entry.privateKey, oaepSpec())
        // The ceremony is bound to this exact cipher, so a successful doFinal is
        // proof the TEE released the key.
        authenticateWithCryptoObject(cipher, prompt, blob, promise)
      } catch (e: KeyPermanentlyInvalidatedException) {
        Log.w(LOG_TAG, "the unlock key was invalidated", e)
        promise.reject(CodedException("invalidated", "key invalidated", null))
      } catch (t: Throwable) {
        Log.w(LOG_TAG, "preparing the unwrap cipher failed", t)
        promise.reject(CodedException("failed", "unwrap failed", null))
      }
    }

    AsyncFunction("checkBinding") { promise: Promise -> promise.resolve(checkBinding()) }

    AsyncFunction("clearBinding") { promise: Promise ->
      clearKeys()
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
          Log.w(LOG_TAG, "reading biometric availability failed", t)
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
    val keyStore =
      try {
        loadKeyStore()
      } catch (t: Throwable) {
        Log.w(LOG_TAG, "opening the keystore failed", t)
        return "unavailable"
      }

    // Ahead of the canary probe, because the canary alone says nothing about the
    // key that actually holds the token. `containsAlias` never prompts.
    val hasUnlockKey =
      try {
        keyStore.containsAlias(UNLOCK_ALIAS)
      } catch (t: Throwable) {
        Log.w(LOG_TAG, "probing the unlock key failed", t)
        return "unavailable"
      }
    if (!hasUnlockKey) return "absent"

    val key =
      try {
        keyStore.getKey(ALIAS, null) as? SecretKey
      } catch (t: Throwable) {
        Log.w(LOG_TAG, "reading the enrollment canary failed", t)
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
      // Only 'absent' and 'changed' destroy the opt-in, so anything unexpected
      // must report the reading it actually is: none.
      Log.w(LOG_TAG, "the enrollment canary probe could not answer", t)
      "unavailable"
    }
  }

  /** The single place that decides what a binding consists of. */
  private fun clearKeys() {
    val keyStore =
      try {
        loadKeyStore()
      } catch (t: Throwable) {
        Log.w(LOG_TAG, "opening the keystore to clear the binding failed", t)
        return
      }
    for (alias in arrayOf(ALIAS, UNLOCK_ALIAS)) {
      try {
        keyStore.deleteEntry(alias)
      } catch (t: Throwable) {
        // Nothing to delete, or the keystore is unreadable; either way the
        // caller has already dropped the secret this guarded.
        Log.w(LOG_TAG, "deleting $alias failed", t)
      }
    }
  }

  private fun createCanaryKey() {
    val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE)
    generator.init(canaryKeySpec())
    generator.generateKey()
  }

  /**
   * The public half, re-imported so it is no longer an AndroidKeyStore key. A key taken straight
   * from the certificate routes its operations through keystore and is subject to the key's own
   * USER_AUTH_REQUIRED, so encrypting with it would demand a ceremony. Detaching it is what makes
   * arming possible with no user present.
   */
  private fun detachedPublicKey(): PublicKey {
    val attached = loadKeyStore().getCertificate(UNLOCK_ALIAS).publicKey
    return KeyFactory.getInstance(KeyProperties.KEY_ALGORITHM_RSA)
      .generatePublic(X509EncodedKeySpec(attached.encoded))
  }

  /**
   * AndroidKeyStore's OAEP defaults MGF1 to SHA-1 regardless of setDigests, and StrongBox supports
   * SHA-256 only — so the default silently diverges from the key spec on one path and is rejected
   * outright on the other.
   */
  private fun oaepSpec(): OAEPParameterSpec =
    OAEPParameterSpec("SHA-256", "MGF1", MGF1ParameterSpec.SHA256, PSource.PSpecified.DEFAULT)

  private fun promptErrorCode(errorCode: Int): String =
    when (errorCode) {
      BiometricPrompt.ERROR_USER_CANCELED,
      BiometricPrompt.ERROR_NEGATIVE_BUTTON -> "user-cancel"
      BiometricPrompt.ERROR_CANCELED -> "system-cancel"
      BiometricPrompt.ERROR_LOCKOUT,
      BiometricPrompt.ERROR_LOCKOUT_PERMANENT -> "lockout"
      BiometricPrompt.ERROR_NO_BIOMETRICS,
      BiometricPrompt.ERROR_HW_NOT_PRESENT,
      BiometricPrompt.ERROR_HW_UNAVAILABLE -> "unavailable"
      else -> "failed"
    }

  private fun authenticateWithCryptoObject(
    cipher: Cipher,
    prompt: Map<String, String>,
    blob: String,
    promise: Promise,
  ) {
    // BiometricPrompt requires one. React Native's host activity is a
    // FragmentActivity, but the cast is checked rather than forced so a host
    // that is not returns 'unavailable' instead of crashing.
    val activity = appContext.currentActivity as? FragmentActivity
    if (activity == null) {
      Log.w(LOG_TAG, "no FragmentActivity to host the biometric prompt")
      promise.reject(CodedException("unavailable", "no activity", null))
      return
    }
    activity.runOnUiThread {
      val info =
        BiometricPrompt.PromptInfo.Builder()
          .setTitle(prompt["title"] ?: "Authenticate")
          .setNegativeButtonText(prompt["cancelLabel"] ?: "Cancel")
          // Matches the bar the opt-in binds at; a class-2 modality must
          // neither bind nor unlock.
          .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
          .build()
      val biometricPrompt =
        BiometricPrompt(
          activity,
          ContextCompat.getMainExecutor(activity),
          object : BiometricPrompt.AuthenticationCallback() {
            // `onAuthenticationFailed` is deliberately not overridden: a single
            // rejected fingerprint is not terminal, and the prompt stays up
            // until the user succeeds, cancels or hits the lockout — each of
            // which arrives through one of the two callbacks below. Rejecting
            // on it would collapse a retry into a failure.
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
              try {
                // The cipher carried by the result is the one the TEE
                // authorised; using any other would defeat the binding.
                val authorized = result.cryptoObject!!.cipher!!
                val token = authorized.doFinal(Base64.decode(blob, Base64.NO_WRAP))
                promise.resolve(token)
              } catch (e: KeyPermanentlyInvalidatedException) {
                Log.w(LOG_TAG, "the unlock key was invalidated mid-ceremony", e)
                promise.reject(CodedException("invalidated", "key invalidated", null))
              } catch (t: Throwable) {
                Log.w(LOG_TAG, "decrypting the token failed", t)
                promise.reject(CodedException("failed", "decrypt failed", null))
              }
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
              promise.reject(
                CodedException(promptErrorCode(errorCode), errString.toString(), null),
              )
            }
          },
        )
      biometricPrompt.authenticate(info, BiometricPrompt.CryptoObject(cipher))
    }
  }

  private fun unlockKeySpec(strongBox: Boolean): KeyGenParameterSpec {
    val builder =
      KeyGenParameterSpec.Builder(
          UNLOCK_ALIAS,
          KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
        )
        .setKeySize(2048)
        .setDigests(KeyProperties.DIGEST_SHA256)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_RSA_OAEP)
        .setUserAuthenticationRequired(true)
        .setInvalidatedByBiometricEnrollment(true)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      builder.setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG)
    } else {
      @Suppress("DEPRECATION")
      builder.setUserAuthenticationValidityDurationSeconds(-1)
    }

    if (strongBox && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      builder.setIsStrongBoxBacked(true)
    }

    return builder.build()
  }

  private fun canaryKeySpec(): KeyGenParameterSpec {
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
