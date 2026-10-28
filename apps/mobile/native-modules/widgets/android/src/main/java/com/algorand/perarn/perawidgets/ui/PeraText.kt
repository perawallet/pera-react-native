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

import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.TextUnit
import androidx.glance.GlanceModifier
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider

// The only place widget text is drawn, so the typeface can change in one spot.
@Composable
fun PeraText(
    text: String,
    size: TextUnit,
    weight: FontWeight,
    color: ColorProvider,
    modifier: GlanceModifier = GlanceModifier,
    align: TextAlign? = null,
) {
    Text(
        text = text,
        modifier = modifier,
        style = TextStyle(color = color, fontSize = size, fontWeight = weight, textAlign = align),
        maxLines = 1,
    )
}

// Glance cannot shrink text to fit, so estimate from the average glyph width (about 0.58 em).
fun fittedTextSize(text: String, availableDp: Float, maxSp: Float, minSp: Float): Float {
    if (text.isEmpty()) return maxSp
    return (availableDp / (text.length * 0.58f)).coerceIn(minSp, maxSp)
}
