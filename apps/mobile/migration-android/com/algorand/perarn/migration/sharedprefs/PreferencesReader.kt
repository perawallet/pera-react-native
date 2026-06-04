/*
 * Copyright 2022-2025 Pera Wallet, LDA
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License
 */
package com.algorand.perarn.migration.sharedprefs

import android.content.SharedPreferences
import android.util.Log
import com.algorand.perarn.migration.bridge.LegacyMigrationConstants
import com.algorand.perarn.migration.bridge.putBoolOrNull
import com.algorand.perarn.migration.bridge.putDoubleOrNull
import com.algorand.perarn.migration.bridge.putIntOrNull
import com.algorand.perarn.migration.bridge.putLongStringOrNull
import com.algorand.perarn.migration.bridge.putStringOrNull
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import org.json.JSONArray
import org.json.JSONException

internal class PreferencesReader(private val prefs: SharedPreferences) {

    fun build(): WritableMap {
        val map = Arguments.createMap()

        map.putStringOrNull("theme", readTheme())
        map.putStringOrNull("currency", prefs.optString("currency_preference_key"))

        map.putBoolOrNull("biometricEnabled", prefs.optBool("use_biometric"))
        map.putBoolOrNull("rekeySupport", prefs.optBool("rekey_support"))
        map.putBoolOrNull("privacyMode", readPrivacyMode())
        map.putBoolOrNull("arc59ExpressSendWarningEnabled", prefs.optBool("arc59_express_send_warning_enabled"))

        map.putIntOrNull("applicationOpenCount", prefs.optInt("applicationOpenCount"))
        map.putIntOrNull("lockAttemptCount", prefs.optInt("lock_attempt_count"))
        map.putLongStringOrNull("lockPenaltyRemainingMs", prefs.optLong("lock_penalty_remaining"), sentinel = -1L)
        map.putLongStringOrNull("appAtBackgroundMs", prefs.optLong("appAtBackground"), sentinel = -1L)
        map.putLongStringOrNull(
            "notificationRefreshTimestampMs",
            readDateMs("notification_refresh_date_key"),
            sentinel = null,
        )

        map.putBoolOrNull("assetFilterZeroBalance", prefs.optBool("asset_filter_zero_balance"))
        map.putBoolOrNull("assetFilterDisplayNFT", prefs.optBool("asset_filter_display_nft_key"))
        map.putBoolOrNull("assetFilterDisplayOptedInNFT", prefs.optBool("asset_filter_display_opted_in_nft_key"))
        map.putBoolOrNull("collectibleFilterNotOwned", prefs.optBool("collectible_filter_not_owned"))
        map.putBoolOrNull("nftFilterDisplayWatchAccountNFTs", prefs.optBool("nft_filter_display_watch_account_nfts"))
        map.putStringOrNull("nftListingViewType", readNftListingViewType())

        map.putStringOrNull("accountSortPreference", readAccountSort())
        map.putStringOrNull("assetSortPreference", readAssetSort())
        map.putStringOrNull("collectibleSortPreference", readCollectibleSort())

        map.putStringOrNull("swapLastUsedAddress", prefs.optJsonString("swap_last_used_address"))
        map.putBoolOrNull("swapUseLocalCurrency", prefs.optJsonBool("swap_use_local_currency_preference"))
        map.putDoubleOrNull("swapSlippageTolerance", readSwapSlippage())
        // Legacy semantics inverted: swapFeatureIntroductionPagePreference is true until T&C accepted; invert for "accepted".
        map.putBoolOrNull("swapTermsAccepted", prefs.optBool("swapFeatureIntroductionPagePreference")?.not())

        map.putMap("rawFlags", buildRawFlags())

        return map
    }

    fun buildTooltipPreferences(): WritableMap {
        val map = Arguments.createMap()
        val tutorialIds = readTutorialIds()

        map.putBoolOrNull("qrTooltipSeen", prefs.optBool("qr_tutorial_shown_key"))
        map.putBoolOrNull("copyAddressTooltipSeen", prefs.optBool("transaction_detail_copy_shown_key"))
        map.putBoolOrNull("copyAddressPromoSeen", tutorialIds?.contains(0))
        map.putBoolOrNull("transactionTutorialSeen", prefs.optBool("transaction_tips_key"))
        map.putBoolOrNull("privacyModeTooltipSeen", tutorialIds?.contains(3))
        map.putBoolOrNull("jointAccountDisclaimerSeen", prefs.optJsonBool("joint_account_disclaimer_seen"))
        map.putBoolOrNull("walletConnectWarningSeen", prefs.optBool("first_request_wallet_connect_request"))
        map.putBoolOrNull("swapIntroSeen", tutorialIds?.contains(1))
        map.putBoolOrNull("giftCardsIntroSeen", tutorialIds?.contains(2))
        map.putBoolOrNull("filterTutorialSeen", prefs.optBool("filter_tutorial_shown_key"))
        map.putBoolOrNull("backupIntroSeen", tutorialIds?.contains(4))

        return map
    }

    fun buildDismissedBanners(): WritableMap {
        val map = Arguments.createMap()
        val ids = Arguments.createArray()
        val raw = prefs.optString("banner_id_list")
        if (!raw.isNullOrBlank()) {
            try {
                val arr = JSONArray(raw)
                for (i in 0 until arr.length()) {
                    // Stringify to avoid Long precision loss across the RN bridge.
                    ids.pushString(arr.opt(i)?.toString() ?: continue)
                }
            } catch (_: JSONException) {
            }
        }
        map.putArray("bannerIds", ids)
        return map
    }

    // `null` (key absent) vs `emptySet()` (key present, no IDs) are kept distinct so callers can tell them apart.
    private fun readTutorialIds(): Set<Int>? {
        val raw = prefs.optString("tutorialIds") ?: return null
        if (raw.isBlank()) return emptySet()
        return try {
            val arr = JSONArray(raw)
            val out = HashSet<Int>(arr.length())
            for (i in 0 until arr.length()) {
                out.add(arr.optInt(i))
            }
            out
        } catch (_: JSONException) {
            null
        }
    }

    private fun readTheme(): String? {
        val raw = prefs.optString("theme_preference_key") ?: return null
        return when (raw.trim().uppercase()) {
            "LIGHT" -> "light"
            "DARK" -> "dark"
            "SYSTEM_DEFAULT", "SYSTEM" -> "system"
            else -> null
        }
    }

    private fun readPrivacyMode(): Boolean? {
        val raw = prefs.optJsonString("shared_pref_privacy_mode") ?: return null
        return when (raw.trim().uppercase()) {
            "ENABLED" -> true
            "DISABLED" -> false
            else -> null
        }
    }

    private fun readAccountSort(): String? {
        val raw = prefs.optString("account_sort_preference") ?: return null
        return when (raw.trim().uppercase()) {
            "MANUAL" -> "manual"
            "ALPHABETICALLY_ASCENDING" -> "alphabeticalAsc"
            "ALPHABETICALLY_DESCENDING" -> "alphabeticalDesc"
            "NUMERIC_ASCENDING" -> "balanceAsc"
            "NUMERIC_DESCENDING" -> "balanceDesc"
            else -> null
        }
    }

    private fun readAssetSort(): String? {
        val raw = prefs.optString("asset_sort_preference") ?: return null
        return when (raw.trim().uppercase()) {
            "ALPHABETICALLY_ASCENDING" -> "alphabeticalAsc"
            "ALPHABETICALLY_DESCENDING" -> "alphabeticalDesc"
            "BALANCE_ASCENDING" -> "balanceAsc"
            "BALANCE_DESCENDING" -> "balanceDesc"
            else -> null
        }
    }

    private fun readCollectibleSort(): String? {
        val raw = prefs.optString("collectible_sort_preference") ?: return null
        return when (raw.trim().uppercase()) {
            "ALPHABETICALLY_ASCENDING" -> "titleAsc"
            "ALPHABETICALLY_DESCENDING" -> "titleDesc"
            "NEWEST_TO_OLDEST" -> "newestFirst"
            "OLDEST_TO_NEWEST" -> "oldestFirst"
            else -> null
        }
    }

    private fun readNftListingViewType(): String? {
        val raw = prefs.optInt("nft_listing_view_type_preference", sentinel = -1) ?: return null
        return when (raw) {
            0 -> "list"
            1 -> "grid"
            else -> null
        }
    }

    private fun readSwapSlippage(): Double? {
        // Legacy slippage range 0.01..10.0; -1.0 sentinel = custom mode (value not preserved), so emit null.
        val raw = prefs.optJsonDouble("swap_slippage_tolerance_preference") ?: return null
        if (!raw.isFinite()) return null
        if (raw < 0.01 || raw > 10.0) return null
        return raw
    }

    private fun readDateMs(key: String): Long? {
        val raw = prefs.optString(key) ?: prefs.optJsonString(key) ?: return null
        raw.toLongOrNull()?.let { return it }
        // ISO-8601 fallback gated on java.time (API 26+): no core-library desugaring, minSdk = 24.
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            return runCatching { java.time.Instant.parse(raw).toEpochMilli() }.getOrNull()
        }
        return null
    }

    private fun buildRawFlags(): WritableMap {
        val out = Arguments.createMap()
        val all = try {
            prefs.all
        } catch (t: Throwable) {
            Log.w(LegacyMigrationConstants.LOG_TAG, "Failed to enumerate SharedPreferences", t)
            return out
        }

        for ((key, value) in all) {
            if (key in TYPED_KEYS) continue
            when (value) {
                is Boolean -> out.putBoolean(key, value)
                is Int -> out.putInt(key, value)
                is Long -> out.putString(key, value.toString())
                is Float -> out.putDouble(key, value.toDouble())
                is Double -> out.putDouble(key, value)
                is String -> out.putString(key, value)
                null -> out.putNull(key)
                else -> out.putString(key, value.toString())
            }
        }
        return out
    }

    private companion object {
        val TYPED_KEYS = setOf(
            "currency_preference_key",
            "theme_preference_key",
            "use_biometric",
            "rekey_support",
            "arc59_express_send_warning_enabled",
            "applicationOpenCount",
            "lock_attempt_count",
            "lock_penalty_remaining",
            "appAtBackground",
            "notification_refresh_date_key",
            "asset_filter_zero_balance",
            "asset_filter_display_nft_key",
            "asset_filter_display_opted_in_nft_key",
            "collectible_filter_not_owned",
            "nft_filter_display_watch_account_nfts",
            "nft_listing_view_type_preference",
            "account_sort_preference",
            "asset_sort_preference",
            "collectible_sort_preference",
            "swapFeatureIntroductionPagePreference",
            "notification_user_id",
            "mainnet_device_id",
            "testnet_device_id",
            "last_seen_notification_id",
            "lock_password",
            "encrypted_pin", // do not leak into rawFlags
            "algorand_accounts", // pre-6.x account blob; handled by LegacyAccountsBlobReader
            "banner_id_list",
            "register_skip_key",
            "notification_activated",
            "lock_preference_count_key",
            "developer_options_status_key",
            "developer_options_feature_flags_key",
            "inbox_last_opened_time",
            "strongbox_used",
            "migrate_to_6x",
            "is_secret_keys_validated_after_6x_migration",
            "utm_source",
            "utm_medium",
            "utm_campaign",
            "utm_term",
            "utm_content",
            "app_review_start_count_key",
            "qr_tutorial_shown_key",
            "transaction_detail_copy_shown_key",
            "transaction_tips_key",
            "filter_tutorial_shown_key",
            "first_request_wallet_connect_request",
            "joint_account_disclaimer_seen",
            "tutorialIds",
            "shared_pref_privacy_mode",
            "swap_last_used_address",
            "swap_use_local_currency_preference",
            "swap_slippage_tolerance_preference",
        )
    }
}
