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
package com.algorand.perarn.perawidgets.config

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.algorand.perarn.perawidgets.R
import com.algorand.perarn.perawidgets.refresh.WidgetUpdater
import com.algorand.perarn.perawidgets.snapshot.SnapshotStore
import com.algorand.perarn.perawidgets.snapshot.WidgetSnapshot

private val Ink = Color(0xFF18181B)
private val Muted = Color(0xFF71717A)
private val Line = Color(0xFFE4E4E7)

class WidgetConfigActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setResult(Activity.RESULT_CANCELED)

    val appWidgetId = intent?.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
      ?: AppWidgetManager.INVALID_APPWIDGET_ID
    val provider = if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
      null
    } else {
      AppWidgetManager.getInstance(this).getAppWidgetInfo(appWidgetId)?.provider
    }
    val kind = widgetKindFor(provider?.className)
    if (provider == null || kind == null) {
      finish()
      return
    }

    val config = WidgetConfig(this)
    val snapshot = SnapshotStore(this).load()

    setContent {
      MaterialTheme(colorScheme = lightColorScheme(primary = Ink)) {
        Surface(Modifier.fillMaxSize(), color = Color.White) {
          when (kind) {
            WidgetKind.Portfolio -> PortfolioSettings(config.portfolio(appWidgetId), snapshot) {
              config.save(appWidgetId, it)
              finishConfigured(appWidgetId, provider)
            }
            WidgetKind.Price -> PriceSettings(config.price(appWidgetId), snapshot) {
              config.save(appWidgetId, it)
              finishConfigured(appWidgetId, provider)
            }
            WidgetKind.Receive -> ReceiveSettings(config.receive(appWidgetId), snapshot) {
              config.save(appWidgetId, it)
              finishConfigured(appWidgetId, provider)
            }
          }
        }
      }
    }
  }

  // The host sends no APPWIDGET_UPDATE after a configure; the broadcast schedules the fetch for the new
  // options, and the redraw makes a live session read them.
  private fun finishConfigured(appWidgetId: Int, provider: ComponentName) {
    WidgetUpdater.redraw(this, appWidgetId)
    sendBroadcast(
      Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE).apply {
        component = provider
        putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, intArrayOf(appWidgetId))
      },
    )
    setResult(RESULT_OK, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId))
    finish()
  }
}

@Composable
private fun PortfolioSettings(initial: PortfolioOptions, snapshot: WidgetSnapshot?, onSave: (PortfolioOptions) -> Unit) {
  var options by remember { mutableStateOf(initial) }
  SettingsPage(R.string.portfolio_name, R.string.portfolio_description, { onSave(options) }) {
    ChoiceRow(R.string.options_chart_period, WidgetChoices.periods, options.period) { options = options.copy(period = it) }
    ToggleRow(R.string.options_show_chart, options.showChart) { options = options.copy(showChart = it) }
    ChoiceRow(R.string.options_account, WidgetChoices.portfolioAccounts(snapshot), options.accountAddress) {
      options = options.copy(accountAddress = it)
    }
  }
}

@Composable
private fun PriceSettings(initial: PriceOptions, snapshot: WidgetSnapshot?, onSave: (PriceOptions) -> Unit) {
  var options by remember { mutableStateOf(initial.copy(assetId = resolvePriceAssetId(initial, snapshot))) }
  SettingsPage(R.string.price_name, R.string.price_description, { onSave(options) }) {
    ChoiceRow(R.string.options_asset, WidgetChoices.assets(snapshot), options.assetId) { options = options.copy(assetId = it) }
    ChoiceRow(R.string.options_currency, WidgetChoices.currencies(snapshot), options.currencyCode) {
      options = options.copy(currencyCode = it)
    }
    ChoiceRow(R.string.options_chart_period, WidgetChoices.periods, options.period) { options = options.copy(period = it) }
    ToggleRow(R.string.options_show_inverse, options.showAssetPerCurrency) { options = options.copy(showAssetPerCurrency = it) }
  }
}

@Composable
private fun ReceiveSettings(initial: ReceiveOptions, snapshot: WidgetSnapshot?, onSave: (ReceiveOptions) -> Unit) {
  var options by remember { mutableStateOf(initial) }
  val choices = WidgetChoices.receiveAccounts(snapshot)
  val selected = resolveReceiveTarget(options, snapshot)?.address
  SettingsPage(R.string.receive_name, R.string.receive_description, { onSave(options) }) {
    ChoiceRow(R.string.options_account, choices, selected) { options = options.copy(accountAddress = it) }
  }
}

@Composable
private fun SettingsPage(title: Int, description: Int, onSave: () -> Unit, rows: @Composable () -> Unit) {
  Column(
    Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp, vertical = 32.dp),
  ) {
    Text(stringResource(title), fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Ink)
    Text(stringResource(description), fontSize = 13.sp, color = Muted, modifier = Modifier.padding(bottom = 10.dp))
    rows()
    Button(
      onClick = onSave,
      modifier = Modifier.fillMaxWidth().padding(top = 22.dp),
      shape = RoundedCornerShape(percent = 50),
      colors = ButtonDefaults.buttonColors(containerColor = Ink, contentColor = Color.White),
      contentPadding = PaddingValues(vertical = 14.dp),
    ) {
      Text(stringResource(R.string.options_add_widget), fontWeight = FontWeight.Medium)
    }
    Text(
      stringResource(R.string.options_hint),
      fontSize = 12.sp,
      color = Muted,
      textAlign = TextAlign.Center,
      modifier = Modifier.fillMaxWidth().padding(top = 14.dp),
    )
  }
}

@Composable
private fun <T> ChoiceRow(label: Int, choices: List<Choice<T>>, selected: T, onSelect: (T) -> Unit) {
  var expanded by remember { mutableStateOf(false) }
  val current = choices.firstOrNull { it.value == selected } ?: choices.firstOrNull()
  Box {
    Row(
      Modifier.fillMaxWidth().clickable { expanded = true }.padding(horizontal = 4.dp, vertical = 14.dp),
      horizontalArrangement = Arrangement.SpaceBetween,
      verticalAlignment = Alignment.CenterVertically,
    ) {
      Text(stringResource(label), fontSize = 14.sp, fontWeight = FontWeight.Medium, color = Muted)
      Text(current?.let { choiceText(it) }.orEmpty(), fontSize = 14.sp, color = Ink)
    }
    DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
      choices.forEach { choice ->
        DropdownMenuItem(
          text = { Text(choiceText(choice)) },
          onClick = {
            expanded = false
            onSelect(choice.value)
          },
        )
      }
    }
  }
  HorizontalDivider(color = Line)
}

@Composable
private fun choiceText(choice: Choice<*>): String = choice.label ?: choice.labelRes?.let { stringResource(it) }.orEmpty()

@Composable
private fun ToggleRow(label: Int, checked: Boolean, onChange: (Boolean) -> Unit) {
  Row(
    Modifier.fillMaxWidth().padding(horizontal = 4.dp),
    horizontalArrangement = Arrangement.SpaceBetween,
    verticalAlignment = Alignment.CenterVertically,
  ) {
    Text(stringResource(label), fontSize = 14.sp, fontWeight = FontWeight.Medium, color = Muted)
    Switch(checked = checked, onCheckedChange = onChange)
  }
  HorizontalDivider(color = Line)
}
