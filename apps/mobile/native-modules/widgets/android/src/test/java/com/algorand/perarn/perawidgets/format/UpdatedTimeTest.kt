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
package com.algorand.perarn.perawidgets.format

import java.time.Instant
import java.time.ZoneId
import java.util.Locale
import org.junit.Test
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue

class UpdatedTimeTest {
    // Stands in for getBestDateTimePattern: the skeleton's hour letter decides the clock.
    private val jvmPatterns: (Locale, String) -> String = { _, skeleton ->
        when (skeleton) {
            UpdatedTime.TIME_24 -> "HH:mm"
            UpdatedTime.TIME_12 -> "h:mm a"
            UpdatedTime.DAY_AND_TIME_24 -> "d MMM HH:mm"
            else -> "d MMM h:mm a"
        }
    }

    private val utc = ZoneId.of("UTC")
    private val updated = Instant.parse("2026-10-27T14:05:00Z")

    private fun normalize(s: String) = s.replace('\u202F', ' ').replace('\u00A0', ' ')

    private fun text(now: Instant, locale: Locale, is24Hour: Boolean = true) =
        normalize(UpdatedTime.text(updated, now, locale, utc, is24Hour, jvmPatterns))

    private fun withPatterns(now: Instant, locale: Locale, patterns: Map<String, String>, is24Hour: Boolean = true) = normalize(
        UpdatedTime.text(updated, now, locale, utc, is24Hour) { _, skeleton -> patterns.getValue(skeleton) },
    )

    @Test fun showsOnlyTheTimeTheSameDay() =
        assertEquals("14:05", text(updated.plusSeconds(3 * 3600), Locale.UK))

    @Test fun followsThePhones24HourSwitchForTheSameLocale() {
        val now = updated.plusSeconds(60)
        assertEquals("14:05", text(now, Locale.US, is24Hour = true))
        assertEquals("2:05 PM", text(now, Locale.US, is24Hour = false))
        assertEquals("27 Oct 14:05", text(tomorrow, Locale.US, is24Hour = true))
        assertEquals("27 Oct 2:05 PM", text(tomorrow, Locale.US, is24Hour = false))
    }

    @Test fun addsTheDayOnceItIsNoLongerToday() {
        val shown = text(updated.plusSeconds(12 * 3600), Locale.UK)
        assertTrue(shown, shown.contains("27") && shown.contains("Oct") && shown.contains("14:05"))
    }

    @Test fun neverShowsATimeAheadOfThePhonesClock() =
        assertEquals("14:03", text(updated.minusSeconds(120), Locale.UK))

    private val tomorrow = updated.plusSeconds(12 * 3600)

    @Test fun usesTheSuppliedLocalizedPatterns() {
        fun patterns24(day: String, time: String) = mapOf(UpdatedTime.TIME_24 to time, UpdatedTime.DAY_AND_TIME_24 to day)
        fun patterns12(day: String, time: String) = mapOf(UpdatedTime.TIME_12 to time, UpdatedTime.DAY_AND_TIME_12 to day)
        assertEquals("27 Oct 14:05", withPatterns(tomorrow, Locale.UK, patterns24("d MMM HH:mm", "HH:mm")))
        assertEquals("27. Okt., 14:05", withPatterns(tomorrow, Locale.GERMANY, patterns24("d. MMM, HH:mm", "HH:mm")))
        assertEquals("Oct 27, 2:05 PM", withPatterns(tomorrow, Locale.US, patterns12("MMM d, h:mm a", "h:mm a"), is24Hour = false))
        assertEquals("2:05 PM", withPatterns(updated.plusSeconds(60), Locale.US, patterns12("MMM d, h:mm a", "h:mm a"), is24Hour = false))
    }

    @Test fun keepsLiteralWordsOfThePattern() {
        val shown = withPatterns(tomorrow, Locale.forLanguageTag("pt-BR"), mapOf(UpdatedTime.DAY_AND_TIME_24 to "d 'de' MMM HH:mm"))
        assertTrue(shown, shown.startsWith("27 de out") && shown.endsWith("14:05"))
    }
}
