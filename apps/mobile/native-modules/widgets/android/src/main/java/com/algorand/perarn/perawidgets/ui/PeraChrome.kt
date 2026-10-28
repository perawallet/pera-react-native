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
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.appwidget.cornerRadius
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.size
import androidx.glance.text.FontWeight
import androidx.glance.text.TextAlign
import com.algorand.perarn.perawidgets.R
import com.algorand.perarn.perawidgets.snapshot.WidgetSnapshot

val NetworkBarHeight = 20.dp

private val CardRadius = 22.dp

@Composable
fun PeraLogo(size: Dp, modifier: GlanceModifier = GlanceModifier) {
    Image(
        provider = ImageProvider(R.drawable.pera_logo),
        contentDescription = null,
        modifier = modifier.size(size).cornerRadius(size / 3.6f),
    )
}

// The bar sits above the content so the logo never lands under it.
@Composable
fun PeraChrome(
    colors: PeraColors,
    network: WidgetSnapshot.Network?,
    modifier: GlanceModifier = GlanceModifier,
    content: @Composable () -> Unit,
) {
    Column(modifier = modifier.fillMaxSize().background(colors.background).cornerRadius(CardRadius)) {
        if (network?.isMainnet == false) {
            Box(
                modifier = GlanceModifier.fillMaxWidth().height(NetworkBarHeight).background(colors.testnetBg),
                contentAlignment = Alignment.Center,
            ) {
                PeraText(network.label.orEmpty(), 11.sp, FontWeight.Medium, colors.testnetText, align = TextAlign.Center)
            }
        }
        Box(modifier = GlanceModifier.fillMaxWidth().defaultWeight()) { content() }
    }
}

@Composable
fun PeraPlaceholder(colors: PeraColors) {
    Box(
        modifier = GlanceModifier.fillMaxSize().background(colors.background).cornerRadius(CardRadius),
        contentAlignment = Alignment.Center,
    ) {
        PeraLogo(44.dp)
    }
}
