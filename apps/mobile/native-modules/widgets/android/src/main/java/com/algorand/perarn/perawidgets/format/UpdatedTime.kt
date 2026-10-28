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
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * When a widget's figures are from, as a clock time ("14:05"), with the day added once it is no
 * longer today. A time stays true between redraws, which Android widgets can't do every minute.
 */
object UpdatedTime {
    const val TIME_24 = "Hmm"
    const val DAY_AND_TIME_24 = "dMMMHmm"
    const val TIME_12 = "hmm"
    const val DAY_AND_TIME_12 = "dMMMhmm"

    // Needs the Android framework, so only production passes it; JVM tests inject patterns.
    val androidPatterns: (Locale, String) -> String = { locale, skeleton ->
        android.text.format.DateFormat.getBestDateTimePattern(locale, skeleton)
    }

    fun text(
        date: Instant,
        now: Instant,
        locale: Locale,
        zone: ZoneId,
        // The phone's 12/24-hour switch, which the locale's own "j" skeleton would ignore.
        is24Hour: Boolean,
        patterns: (Locale, String) -> String,
    ): String {
        // The data's clock can run slightly ahead of the phone's; never show a time still to come.
        val shown = minOf(date, now).atZone(zone)
        val isToday = shown.toLocalDate() == now.atZone(zone).toLocalDate()
        val skeleton = when {
            isToday && is24Hour -> TIME_24
            isToday -> TIME_12
            is24Hour -> DAY_AND_TIME_24
            else -> DAY_AND_TIME_12
        }
        return DateTimeFormatter.ofPattern(patterns(locale, skeleton), locale).format(shown)
    }
}
