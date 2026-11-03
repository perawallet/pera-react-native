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

import android.icu.text.DisplayContext
import android.icu.text.RelativeDateTimeFormatter
import android.icu.util.ULocale
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

enum class RowDay { Today, Yesterday, Earlier }

// Transaction rows say when, not how long ago: a widget may not redraw for hours, and "5 min. ago" would stay up
// that long. A clock time today (as "Updated"), then "Yesterday", then a short date.
object RowTime {
    const val DATE = "dMMM"
    const val DATE_WITH_YEAR = "yMMMd"

    // A date ahead of the phone's clock counts as now.
    fun day(date: Instant, now: Instant, zone: ZoneId): RowDay {
        val day = minOf(date, now).atZone(zone).toLocalDate()
        val today = now.atZone(zone).toLocalDate()
        return when (day) {
            today -> RowDay.Today
            today.minusDays(1) -> RowDay.Yesterday
            else -> RowDay.Earlier
        }
    }

    fun text(
        date: Instant,
        now: Instant,
        locale: Locale,
        zone: ZoneId,
        is24Hour: Boolean,
        patterns: (Locale, String) -> String,
        yesterday: (Locale) -> String,
    ): String {
        val shown = minOf(date, now).atZone(zone)
        val skeleton = when (day(date, now, zone)) {
            RowDay.Yesterday -> return yesterday(locale)
            RowDay.Today -> if (is24Hour) UpdatedTime.TIME_24 else UpdatedTime.TIME_12
            RowDay.Earlier -> if (shown.year == now.atZone(zone).year) DATE else DATE_WITH_YEAR
        }
        return DateTimeFormatter.ofPattern(patterns(locale, skeleton), locale).format(shown)
    }

    // Needs the Android framework, so only production passes it; JVM tests inject the word.
    val androidYesterday: (Locale) -> String = { locale ->
        RelativeDateTimeFormatter.getInstance(
            ULocale.forLocale(locale),
            null,
            RelativeDateTimeFormatter.Style.LONG,
            DisplayContext.CAPITALIZATION_FOR_BEGINNING_OF_SENTENCE,
        ).format(RelativeDateTimeFormatter.Direction.LAST, RelativeDateTimeFormatter.AbsoluteUnit.DAY)
    }
}
