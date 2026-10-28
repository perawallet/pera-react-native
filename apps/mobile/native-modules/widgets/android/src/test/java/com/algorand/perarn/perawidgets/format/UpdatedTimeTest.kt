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
    private val utc = ZoneId.of("UTC")
    private val updated = Instant.parse("2026-10-27T14:05:00Z")

    private fun normalize(s: String) = s.replace('\u202F', ' ').replace('\u00A0', ' ')

    private fun text(now: Instant, locale: Locale) = normalize(UpdatedTime.text(updated, now, locale, utc))

    private fun withPatterns(now: Instant, locale: Locale, patterns: Map<String, String>) = normalize(
        UpdatedTime.text(updated, now, locale, utc) { _, skeleton -> patterns.getValue(skeleton) },
    )

    @Test fun showsOnlyTheTimeTheSameDay() =
        assertEquals("14:05", text(updated.plusSeconds(3 * 3600), Locale.UK))

    @Test fun followsTheLanguagesClock() {
        val now = updated.plusSeconds(60)
        assertEquals("2:05 PM", text(now, Locale.US))
        assertEquals("14:05", text(now, Locale.GERMANY))
    }

    @Test fun addsTheDayOnceItIsNoLongerToday() {
        val shown = text(updated.plusSeconds(12 * 3600), Locale.UK)
        assertTrue(shown, shown.contains("27") && shown.contains("Oct") && shown.contains("14:05"))
    }

    @Test fun neverShowsATimeAheadOfThePhonesClock() =
        assertEquals("14:03", text(updated.minusSeconds(120), Locale.UK))

    private val tomorrow = updated.plusSeconds(12 * 3600)

    @Test fun usesTheSuppliedLocalizedPatterns() {
        fun patterns(day: String, time: String) = mapOf("jmm" to time, "dMMMjmm" to day)
        assertEquals("27 Oct 14:05", withPatterns(tomorrow, Locale.UK, patterns("d MMM HH:mm", "HH:mm")))
        assertEquals("27. Okt., 14:05", withPatterns(tomorrow, Locale.GERMANY, patterns("d. MMM, HH:mm", "HH:mm")))
        assertEquals("Oct 27, 2:05 PM", withPatterns(tomorrow, Locale.US, patterns("MMM d, h:mm a", "h:mm a")))
        assertEquals("2:05 PM", withPatterns(updated.plusSeconds(60), Locale.US, patterns("MMM d, h:mm a", "h:mm a")))
    }

    @Test fun keepsLiteralWordsOfThePattern() {
        val shown = withPatterns(tomorrow, Locale.forLanguageTag("pt-BR"), mapOf("dMMMjmm" to "d 'de' MMM HH:mm"))
        assertTrue(shown, shown.startsWith("27 de out") && shown.endsWith("14:05"))
    }
}
