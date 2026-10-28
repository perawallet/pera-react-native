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
package com.algorand.perarn.perawidgets.widgets

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.datastore.preferences.core.Preferences
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.ContentScale
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.glance.text.FontWeight
import androidx.glance.text.TextAlign
import com.algorand.perarn.perawidgets.config.WidgetConfig
import com.algorand.perarn.perawidgets.refresh.WidgetVersion
import com.algorand.perarn.perawidgets.snapshot.SnapshotStore
import com.algorand.perarn.perawidgets.snapshot.WidgetSnapshot
import com.algorand.perarn.perawidgets.ui.PeraChrome
import com.algorand.perarn.perawidgets.ui.PeraColors
import com.algorand.perarn.perawidgets.ui.PeraLogo
import com.algorand.perarn.perawidgets.ui.PeraPlaceholder
import com.algorand.perarn.perawidgets.ui.PeraText
import com.algorand.perarn.perawidgets.ui.PeraTheme
import com.algorand.perarn.perawidgets.ui.qrBitmap

class ReceiveWidget : GlanceAppWidget() {
    override val sizeMode = SizeMode.Exact
    override val stateDefinition = PreferencesGlanceStateDefinition

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val appWidgetId = GlanceAppWidgetManager(context).getAppWidgetId(id)

        provideContent {
            val version = currentState<Preferences>()[WidgetVersion.key]
            val snapshot = remember(version) { SnapshotStore(context).load() }
            val content = remember(version) { receiveContent(snapshot, WidgetConfig(context).receive(appWidgetId)) }
            val qr = remember(version) { content?.let { qrBitmap(it.payload) } }
            val colors = PeraTheme.colors(snapshot?.theme)
            if (snapshot == null || content == null || qr == null) {
                PeraPlaceholder(colors)
            } else {
                ReceiveView(context, snapshot, content, qr, colors)
            }
        }
    }
}

@Composable
private fun ReceiveView(
    context: Context,
    snapshot: WidgetSnapshot,
    content: ReceiveContent,
    qr: Bitmap,
    colors: PeraColors,
) {
    val size = LocalSize.current
    val layout = receiveLayout(size.width.value, size.height.value, snapshot.network?.isMainnet == false)
    val open = Intent(Intent.ACTION_VIEW, Uri.parse(content.tapUrl)).setPackage(context.packageName)

    PeraChrome(colors, snapshot.network, GlanceModifier.clickable(actionStartActivity(open))) {
        Box(modifier = GlanceModifier.fillMaxSize()) {
            Column(
                modifier = GlanceModifier.fillMaxSize().padding(
                    start = QR_PADDING_DP.dp, end = (QR_PADDING_DP + 2 * layout.shiftLeftDp).dp, top = layout.topDp.dp, bottom = QR_PADDING_DP.dp,
                ),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Image(
                    provider = ImageProvider(qr),
                    contentDescription = null,
                    modifier = GlanceModifier.size(layout.sideDp.dp).background(Color.White).cornerRadius(8.dp),
                    contentScale = ContentScale.Fit,
                )
                Spacer(GlanceModifier.height(QR_GAP_DP.dp))
                PeraText(content.label, 11.sp, FontWeight.Medium, colors.textMain, align = TextAlign.Center)
            }
            Box(modifier = GlanceModifier.fillMaxSize().padding(top = QR_LOGO_MARGIN_DP.dp, end = QR_LOGO_MARGIN_DP.dp), contentAlignment = Alignment.TopEnd) {
                PeraLogo(LOGO_DP.dp)
            }
        }
    }
}
