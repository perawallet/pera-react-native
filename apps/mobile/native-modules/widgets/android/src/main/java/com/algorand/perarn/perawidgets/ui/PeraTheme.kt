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
package com.algorand.perarn.perawidgets.ui

import androidx.compose.ui.graphics.Color
import androidx.glance.color.ColorProvider
import androidx.glance.unit.ColorProvider as fixedColor

// Hand-copied from the iOS widget's expo-target.config.js (itself copied from the app's theme tokens).
object PeraPalette {
    val backgroundLight = Color(0xFFFFFFFF)
    val backgroundDark = Color(0xFF18181B)
    val textMainLight = Color(0xFF18181B)
    val textMainDark = Color(0xFFF1F1F2)
    val textGrayLight = Color(0xFF71717A)
    val textGrayDark = Color(0xFFA1A1AA)
    val positiveLight = Color(0xFF1F8E9D)
    val positiveDark = Color(0xFF2CB7BC)
    val negativeLight = Color(0xFFDB4645)
    val negativeDark = Color(0xFFFF6D5F)
    val testnetBg = Color(0xFFEDB21C)
    val testnetText = Color(0xFF18181B)
}

class PeraColors(val isDark: Boolean?) {
    private fun pick(light: Color, dark: Color) = when (isDark) {
        null -> ColorProvider(day = light, night = dark)
        true -> fixedColor(dark)
        false -> fixedColor(light)
    }

    val background = pick(PeraPalette.backgroundLight, PeraPalette.backgroundDark)
    val textMain = pick(PeraPalette.textMainLight, PeraPalette.textMainDark)
    val textGray = pick(PeraPalette.textGrayLight, PeraPalette.textGrayDark)
    val positive = pick(PeraPalette.positiveLight, PeraPalette.positiveDark)
    val negative = pick(PeraPalette.negativeLight, PeraPalette.negativeDark)
    val testnetBg = fixedColor(PeraPalette.testnetBg)
    val testnetText = fixedColor(PeraPalette.testnetText)
}

object PeraTheme {
    fun isDark(theme: String?, systemIsDark: Boolean): Boolean = when (theme) {
        "light" -> false
        "dark" -> true
        else -> systemIsDark
    }

    // Light and dark are fixed; "system" resolves per draw from the phone's night mode.
    fun colors(theme: String?): PeraColors = PeraColors(
        when (theme) {
            "light" -> false
            "dark" -> true
            else -> null
        },
    )

    fun trendColor(isUp: Boolean, isDark: Boolean): Color = when {
        isUp && isDark -> PeraPalette.positiveDark
        isUp -> PeraPalette.positiveLight
        isDark -> PeraPalette.negativeDark
        else -> PeraPalette.negativeLight
    }
}
