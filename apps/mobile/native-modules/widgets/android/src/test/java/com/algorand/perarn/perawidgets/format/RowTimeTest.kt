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
import org.junit.Assert.assertEquals
import org.junit.Test

class RowTimeTest {
    private val zone = ZoneId.of("Europe/Lisbon")
    private val now = Instant.parse("2026-11-03T15:00:00Z")

    // Stand in for getBestDateTimePattern and ICU's "yesterday", which need the Android framework.
    private val patterns: (Locale, String) -> String = { _, skeleton ->
        when (skeleton) {
            UpdatedTime.TIME_24 -> "HH:mm"
            UpdatedTime.TIME_12 -> "h:mm a"
            RowTime.DATE -> "d MMM"
            else -> "d MMM yyyy"
        }
    }
    private val yesterday: (Locale) -> String = { "Yesterday" }

    private fun text(date: Instant, is24Hour: Boolean = true) =
        RowTime.text(date, now, Locale.UK, zone, is24Hour, patterns, yesterday).replace(' ', ' ')

    @Test fun todayIsAClockTimeThatNeverGoesStale() {
        assertEquals("14:58", text(Instant.parse("2026-11-03T14:58:00Z")))
        assertEquals("00:05", text(Instant.parse("2026-11-03T00:05:00Z")))
    }

    @Test fun followsThePhones12HourSetting() =
        assertEquals("2:58 pm", text(Instant.parse("2026-11-03T14:58:00Z"), is24Hour = false).lowercase())

    @Test fun theDayBeforeIsYesterdayByTheLocalCalendar() {
        assertEquals("Yesterday", text(Instant.parse("2026-11-02T23:59:00Z")))
        assertEquals(RowDay.Yesterday, RowTime.day(Instant.parse("2026-11-02T00:00:00Z"), now, zone))
    }

    @Test fun olderIsAShortDateWithTheYearOnlyWhenItDiffers() {
        assertEquals("31 Oct", text(Instant.parse("2026-10-31T10:00:00Z")))
        assertEquals("20 Dec 2025", text(Instant.parse("2025-12-20T10:00:00Z")))
    }

    @Test fun aDateAheadOfThePhoneCountsAsNow() {
        assertEquals(RowDay.Today, RowTime.day(now.plusSeconds(86_400), now, zone))
        assertEquals("15:00", text(now.plusSeconds(600)))
    }
}
