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

package com.algorand.perarn.passkeyautofillsecrets

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Persists the keystore master key into the shared passkey-autofill store as
 * **raw bytes**, so a non-zeroable hex string never has to exist in the JS
 * heap (the bridge that would otherwise take a hex `String`).
 *
 * The on-disk format intentionally mirrors
 * `@algorandfoundation/react-native-passkey-autofill`'s Android
 * `CredentialRepository`: the master key is AES/GCM-encrypted under the shared
 * AndroidKeyStore alias and stored in the `PasskeyAutofillKeychain`
 * SharedPreferences as base64 `iv` + `content`. The credential-provider service
 * reads it back via the same alias and preferences. The only difference is the
 * input — the external module receives a hex `String` and decodes it; we
 * receive the raw bytes directly.
 *
 * After writing, we read the value back and compare it to the input. Only a
 * verified round-trip resolves `true`; anything else resolves `false` so the
 * JS caller falls back to the proven string bridge rather than silently leaving
 * the credential provider unable to read the key.
 */
class PeraPasskeyAutofillSecretsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PeraPasskeyAutofillSecrets")

    AsyncFunction("setMasterKey") { secret: ByteArray ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      try {
        encryptToKeychain(context, secret)
        val readBack = decryptFromKeychain(context)
        readBack != null && readBack.contentEquals(secret)
      } catch (e: Exception) {
        false
      } finally {
        // Wipe our copy — mirrors the JS-side Buffer.fill(0).
        secret.fill(0)
      }
    }
  }

  private fun getSecretKey(): SecretKey {
    val ks = KeyStore.getInstance("AndroidKeyStore")
    ks.load(null)
    if (!ks.containsAlias(MASTER_KEY_ALIAS)) {
      val generator =
        KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
      generator.init(
        KeyGenParameterSpec.Builder(
          MASTER_KEY_ALIAS,
          KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
        )
          .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
          .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
          .setKeySize(256)
          .build(),
      )
      generator.generateKey()
    }
    return ks.getKey(MASTER_KEY_ALIAS, null) as SecretKey
  }

  private fun encryptToKeychain(context: Context, data: ByteArray) {
    val cipher = Cipher.getInstance(AES_GCM_NO_PADDING)
    cipher.init(Cipher.ENCRYPT_MODE, getSecretKey())
    val iv = cipher.iv
    val encrypted = cipher.doFinal(data)
    context
      .getSharedPreferences(KEYCHAIN_STORAGE_NAME, Context.MODE_PRIVATE)
      .edit()
      .putString("iv", Base64.encodeToString(iv, Base64.NO_WRAP))
      .putString("content", Base64.encodeToString(encrypted, Base64.NO_WRAP))
      .apply()
  }

  private fun decryptFromKeychain(context: Context): ByteArray? {
    val prefs = context.getSharedPreferences(KEYCHAIN_STORAGE_NAME, Context.MODE_PRIVATE)
    val ivStr = prefs.getString("iv", null) ?: return null
    val contentStr = prefs.getString("content", null) ?: return null
    val iv = Base64.decode(ivStr, Base64.NO_WRAP)
    val content = Base64.decode(contentStr, Base64.NO_WRAP)
    val cipher = Cipher.getInstance(AES_GCM_NO_PADDING)
    cipher.init(Cipher.DECRYPT_MODE, getSecretKey(), GCMParameterSpec(128, iv))
    return cipher.doFinal(content)
  }

  private companion object {
    const val AES_GCM_NO_PADDING = "AES/GCM/NoPadding"
    // Shared with @algorandfoundation/react-native-passkey-autofill's
    // CredentialRepository so the credential provider decrypts what we write.
    const val MASTER_KEY_ALIAS = "co.algorand.passkeyautofill.masterkey"
    const val KEYCHAIN_STORAGE_NAME = "PasskeyAutofillKeychain"
  }
}
