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
import java.time.chrono.IsoChronology
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeFormatterBuilder
import java.time.format.FormatStyle
import java.util.Locale

/**
 * When a widget's figures are from, as a clock time ("14:05"), with the day added once it is no
 * longer today. A time stays true between redraws, which Android widgets can't do every minute.
 */
object UpdatedTime {
    const val TIME_SKELETON = "jmm"
    const val DAY_AND_TIME_SKELETON = "dMMMjmm"

    // Needs the Android framework, so only production passes it; JVM tests inject patterns.
    val androidPatterns: (Locale, String) -> String = { locale, skeleton ->
        android.text.format.DateFormat.getBestDateTimePattern(locale, skeleton)
    }

    // Approximates the skeletons without the framework, for callers that don't supply patterns.
    val jvmPatterns: (Locale, String) -> String = { locale, skeleton ->
        val time = DateTimeFormatterBuilder.getLocalizedDateTimePattern(
            null, FormatStyle.SHORT, IsoChronology.INSTANCE, locale,
        )
        if (skeleton == TIME_SKELETON) time else "d MMM $time"
    }

    fun text(
        date: Instant,
        now: Instant,
        locale: Locale,
        zone: ZoneId = ZoneId.systemDefault(),
        patterns: (Locale, String) -> String = jvmPatterns,
    ): String {
        // The data's clock can run slightly ahead of the phone's; never show a time still to come.
        val shown = minOf(date, now).atZone(zone)
        val skeleton = if (shown.toLocalDate() == now.atZone(zone).toLocalDate()) {
            TIME_SKELETON
        } else {
            DAY_AND_TIME_SKELETON
        }
        return DateTimeFormatter.ofPattern(patterns(locale, skeleton), locale).format(shown)
    }
}
