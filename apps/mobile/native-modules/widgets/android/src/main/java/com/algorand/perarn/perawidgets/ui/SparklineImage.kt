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

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.unit.dp
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.layout.ContentScale
import androidx.glance.layout.size

@Composable
fun SparklineImage(
    context: Context,
    chart: List<Double>,
    widthDp: Float,
    heightDp: Float,
    isUp: Boolean,
    isDark: Boolean,
    modifier: GlanceModifier = GlanceModifier.size(widthDp.dp, heightDp.dp),
) {
    val density = context.resources.displayMetrics.density
    val widthPx = (widthDp * density).toInt()
    val heightPx = (heightDp * density).toInt()
    val color = PeraTheme.trendColor(isUp, isDark).toArgb()
    val bitmap = remember(chart, widthPx, heightPx, color) { Sparkline.bitmap(chart, widthPx, heightPx, color, 1.5f * density) }
    Image(
        provider = ImageProvider(bitmap),
        contentDescription = null,
        modifier = modifier,
        contentScale = ContentScale.FillBounds,
    )
}
