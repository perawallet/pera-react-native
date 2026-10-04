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
 * Two keys, created and destroyed as one unit:
 *
 * - An RSA pair at `pera.biometric.unlock` holds the secret: the token is wrapped to its public
 *   half and only a BiometricPrompt-authorised `Cipher` can unwrap it.
 * - An AES canary at `pera.biometric.enrollment` holds nothing; it exists because it is the only
 *   probe that can classify an invalidation without a ceremony. `Cipher.init` on it raises
 *   `KeyPermanentlyInvalidatedException` directly, whereas reaching the RSA private key goes
 *   through `KeyStore.getEntry`, which turns the same invalidation into
 *   `UnrecoverableKeyException` and loses the distinction between 'changed' and never there.
 *
 * `checkBinding` resolves 'valid' | 'changed' | 'absent' | 'unavailable'; `beginUnwrap` and
 * `finishUnwrap` reject with one of 'invalidated', 'decrypt-failed', 'no-binding', 'user-cancel',
 * 'system-cancel', 'lockout', 'unavailable', 'failed'. Anything else degrades to 'unknown' in
 * JavaScript.
 */
class PeraBiometricBindingModule : Module() {
  // One unwrap at a time. The prompt's callbacks land on the main thread and the module's calls on
  // the Expo queue, so every field is read and written under `lock`; `generation` lets a callback
  // from a cancelled or superseded prompt see that it no longer owns the session.
  private val lock = Any()
  private var generation = 0
  private var activePrompt: BiometricPrompt? = null
  private var pendingBegin: Promise? = null
  private var authorizedCipher: Cipher? = null

  override fun definition() = ModuleDefinition {
    Name("PeraBiometricBinding")

    // Ceremony-free on purpose: the public half does the wrapping, and the legacy migration arms
    // with no user present.
    AsyncFunction("armBinding") { promise: Promise ->
      try {
        // Generating over a live alias fails, so delete first to stay idempotent.
        clearKeys()
        val generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_RSA, KEYSTORE)
        generator.initialize(unlockKeySpec())
        generator.generateKeyPair()
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
        // A null return reads the same in JS whatever the cause, so the reason lives only here.
        Log.w(LOG_TAG, "arming the binding failed", t)
        // The reconcile early-returns without a blob, so a key left behind is never cleared.
        clearKeys()
        promise.resolve(null)
      }
    }

    // The ceremony alone: the prompt goes up without waiting for the blob, and a passed ceremony
    // holds the authorised cipher for `finishUnwrap`.
    AsyncFunction("beginUnwrap") { prompt: Map<String, String>, promise: Promise ->
      val session = synchronized(lock) {
        endSession()
        generation
      }
      try {
        val entry = loadKeyStore().getEntry(UNLOCK_ALIAS, null) as? KeyStore.PrivateKeyEntry
        if (entry == null) {
          promise.reject(CodedException("no-binding", "no key", null))
          return@AsyncFunction
        }
        val cipher = Cipher.getInstance(RSA_TRANSFORMATION)
        cipher.init(Cipher.DECRYPT_MODE, entry.privateKey, oaepSpec())
        authenticateWithCryptoObject(cipher, prompt, session, promise)
      } catch (e: KeyPermanentlyInvalidatedException) {
        Log.w(LOG_TAG, "the unlock key was invalidated", e)
        promise.reject(CodedException("invalidated", "key invalidated", null))
      } catch (t: Throwable) {
        Log.w(LOG_TAG, "preparing the unwrap cipher failed", t)
        promise.reject(CodedException("decrypt-failed", "unwrap failed", null))
      }
    }

    AsyncFunction("finishUnwrap") { blob: String, promise: Promise ->
      val cipher = synchronized(lock) {
        authorizedCipher.also { authorizedCipher = null }
      }
      if (cipher == null) {
        promise.reject(CodedException("failed", "no authorised unwrap", null))
        return@AsyncFunction
      }
      try {
        // The cipher the TEE authorised; any other would defeat the binding.
        promise.resolve(cipher.doFinal(Base64.decode(blob, Base64.NO_WRAP)))
      } catch (e: KeyPermanentlyInvalidatedException) {
        Log.w(LOG_TAG, "the unlock key was invalidated mid-unwrap", e)
        promise.reject(CodedException("invalidated", "key invalidated", null))
      } catch (t: Throwable) {
        Log.w(LOG_TAG, "decrypting the token failed", t)
        promise.reject(CodedException("decrypt-failed", "decrypt failed", null))
      }
    }

    // A prompt still up is dismissed and its `beginUnwrap` rejected with 'system-cancel'.
    AsyncFunction("cancelUnwrap") { promise: Promise ->
      synchronized(lock) { endSession() }
      promise.resolve(null)
    }

    AsyncFunction("checkBinding") { promise: Promise -> promise.resolve(checkBinding()) }

    AsyncFunction("clearBinding") { promise: Promise ->
      clearKeys()
      promise.resolve(null)
    }

    // The raw `canAuthenticate` code, which expo's `isEnrolledAsync` collapses into a boolean.
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
          // Needs a system update rather than an enrollment, so the enrollment copy would be
          // wrong; treated as temporary.
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

    val canary =
      try {
        keyStore.getKey(ALIAS, null) as? SecretKey
      } catch (t: Throwable) {
        Log.w(LOG_TAG, "reading the enrollment canary failed", t)
        return "unavailable"
      }

    // Probe the canary before looking for the alias: `containsAlias` goes through
    // `getKeyMetadata`, which swallows a keystore2 KEY_PERMANENTLY_INVALIDATED and reports the key
    // as missing, so probing second would make 'changed' unreachable.
    if (canary != null) {
      try {
        Cipher.getInstance(TRANSFORMATION).init(Cipher.ENCRYPT_MODE, canary)
      } catch (e: KeyPermanentlyInvalidatedException) {
        return "changed"
      } catch (e: UserNotAuthenticatedException) {
        // Intact and merely unauthenticated, which is a binding.
      } catch (t: Throwable) {
        // Only 'absent' and 'changed' destroy the opt-in, so anything unexpected reports no reading.
        Log.w(LOG_TAG, "the enrollment canary probe could not answer", t)
        return "unavailable"
      }
    }

    if (!keyStore.containsAlias(UNLOCK_ALIAS)) return "absent"
    // Half a binding cannot detect a re-enrollment, so it is not one.
    if (canary == null) return "absent"

    return "valid"
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
   * The public half re-imported so it is no longer an AndroidKeyStore key. Straight from the
   * certificate it still routes through keystore and is subject to the key's USER_AUTH_REQUIRED,
   * so encrypting with it would demand a ceremony.
   */
  private fun detachedPublicKey(): PublicKey {
    val attached = loadKeyStore().getCertificate(UNLOCK_ALIAS).publicKey
    return KeyFactory.getInstance(KeyProperties.KEY_ALGORITHM_RSA)
      .generatePublic(X509EncodedKeySpec(attached.encoded))
  }

  /**
   * MGF1 stays on SHA-1 with the primary digest on SHA-256. Below API 34 the framework's keystore
   * cipher rejects any other MGF1 digest at `Cipher.init`, and from 34 SHA-1 is the KeyMint default
   * that every key authorises whether or not it carries an MGF1 tag, so one spec decrypts every key
   * ever minted, including across an OS upgrade. The explicit spec matters because the detached
   * public key encrypts through Conscrypt, whose own default differs.
   */
  private fun oaepSpec(): OAEPParameterSpec =
    OAEPParameterSpec("SHA-256", "MGF1", MGF1ParameterSpec.SHA1, PSource.PSpecified.DEFAULT)

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

  /**
   * Called with `lock` held: drops the authorised cipher and dismisses a prompt still up. Its
   * promise is settled here rather than left to the prompt's error callback, which a cancel from
   * the app is not guaranteed to fire.
   */
  private fun endSession() {
    generation += 1
    authorizedCipher = null
    pendingBegin?.reject(CodedException("system-cancel", "unwrap cancelled", null))
    pendingBegin = null
    val prompt = activePrompt ?: return
    activePrompt = null
    appContext.currentActivity?.runOnUiThread { prompt.cancelAuthentication() }
  }

  /** Under `lock`: whether this prompt's callback still owns the session, ending it if so. */
  private fun claimSession(session: Int, promise: Promise): Boolean {
    val owns = session == generation && pendingBegin === promise
    if (owns) {
      activePrompt = null
      pendingBegin = null
    }
    return owns
  }

  private fun authenticateWithCryptoObject(
    cipher: Cipher,
    prompt: Map<String, String>,
    session: Int,
    promise: Promise,
  ) {
    // A checked cast, so a host that is not a FragmentActivity reports 'unavailable' rather than
    // crashing.
    val activity = appContext.currentActivity as? FragmentActivity
    if (activity == null) {
      Log.w(LOG_TAG, "no FragmentActivity to host the biometric prompt")
      promise.reject(CodedException("unavailable", "no activity", null))
      return
    }
    activity.runOnUiThread {
      // Nothing outside this block can settle the promise any more, and an unsettled promise hangs
      // the unlock for the whole cycle and leaks the KeyMint operation: every exit must reject.
      try {
        // Past `onSaveInstanceState`, `BiometricPrompt.authenticateInternal` returns without ever
        // firing a callback.
        if (
          activity.isDestroyed ||
          activity.isFinishing ||
          activity.supportFragmentManager.isStateSaved
        ) {
          Log.w(LOG_TAG, "the host activity cannot show a biometric prompt")
          promise.reject(CodedException("unavailable", "prompt unavailable", null))
          return@runOnUiThread
        }
        showPrompt(activity, prompt, session, cipher, promise)
      } catch (t: Throwable) {
        Log.w(LOG_TAG, "showing the biometric prompt failed", t)
        promise.reject(CodedException("unavailable", "prompt unavailable", null))
      }
    }
  }

  private fun showPrompt(
    activity: FragmentActivity,
    prompt: Map<String, String>,
    session: Int,
    cipher: Cipher,
    promise: Promise,
  ) {
    // The copy is translated by the caller; an empty title or negative text makes `build()` throw,
    // which the caller reports as 'unavailable'.
    val info =
      BiometricPrompt.PromptInfo.Builder()
        .setTitle(prompt["title"].orEmpty())
        .setNegativeButtonText(prompt["cancelLabel"].orEmpty())
        // The bar the opt-in binds at; a class-2 modality must neither bind nor unlock.
        .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
        .build()
    val biometricPrompt =
      BiometricPrompt(
        activity,
        ContextCompat.getMainExecutor(activity),
        object : BiometricPrompt.AuthenticationCallback() {
          // `onAuthenticationFailed` is deliberately not overridden: a rejected fingerprint is not
          // terminal, and the prompt stays up until one of the two callbacks below fires.
          override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
            val authorized = result.cryptoObject?.cipher
            val owns = synchronized(lock) {
              claimSession(session, promise).also { if (it) authorizedCipher = authorized }
            }
            // A session that was cancelled or superseded has already been settled.
            when {
              !owns -> return
              authorized == null -> {
                Log.w(LOG_TAG, "the passed ceremony returned no cipher")
                promise.reject(CodedException("decrypt-failed", "no authorised cipher", null))
              }
              else -> promise.resolve(null)
            }
          }

          override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
            // JS keeps only the mapped reason, so the raw code is logged here or lost.
            Log.w(LOG_TAG, "the biometric prompt failed: $errorCode $errString")
            if (!synchronized(lock) { claimSession(session, promise) }) return
            promise.reject(
              CodedException(promptErrorCode(errorCode), errString.toString(), null),
            )
          }
        },
      )
    // Checked and registered in one step: a cancel that lands before this has no prompt to dismiss
    // and must stop it going up, and one after finds it. Its dismissal is posted to this thread, so
    // it runs after `authenticate`.
    val isCurrent = synchronized(lock) {
      (session == generation).also {
        if (it) {
          activePrompt = biometricPrompt
          pendingBegin = promise
        }
      }
    }
    if (!isCurrent) {
      promise.reject(CodedException("system-cancel", "unwrap cancelled", null))
      return
    }
    biometricPrompt.authenticate(info, BiometricPrompt.CryptoObject(cipher))
  }

  /**
   * TEE-backed, not StrongBox: a secure element searches for RSA primes on its own small processor
   * and holds the keystore while it does, stalling every other keystore user in the app. An EC key
   * would be fast enough there, but `BiometricPrompt.CryptoObject` cannot carry a `KeyAgreement`.
   */
  private fun unlockKeySpec(): KeyGenParameterSpec {
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

    applyAuthPerUse(builder)

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

    applyAuthPerUse(builder)

    return builder.build()
  }

  // Authentication on every use is what binds a key to the biometric set rather than to a time
  // window.
  private fun applyAuthPerUse(builder: KeyGenParameterSpec.Builder) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      builder.setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG)
    } else {
      @Suppress("DEPRECATION")
      builder.setUserAuthenticationValidityDurationSeconds(-1)
    }
  }

  private fun loadKeyStore(): KeyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }
}
