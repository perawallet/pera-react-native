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
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
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
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.algorand.perarn.perawidgets.R
import com.algorand.perarn.perawidgets.fetch.CurrenciesFetcher
import com.algorand.perarn.perawidgets.fetch.FetchedCurrency
import com.algorand.perarn.perawidgets.fetch.Http
import com.algorand.perarn.perawidgets.refresh.WidgetUpdater
import com.algorand.perarn.perawidgets.snapshot.SnapshotStore
import com.algorand.perarn.perawidgets.snapshot.WidgetSnapshot
import com.algorand.perarn.perawidgets.ui.PeraPalette
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

private class SettingsColors(val background: Color, val ink: Color, val muted: Color, val line: Color)

private val LightSettings = SettingsColors(PeraPalette.backgroundLight, PeraPalette.textMainLight, PeraPalette.textGrayLight, PeraPalette.layerLight)
private val DarkSettings = SettingsColors(PeraPalette.backgroundDark, PeraPalette.textMainDark, PeraPalette.textGrayDark, PeraPalette.layerDark)
private val LocalSettingsColors = staticCompositionLocalOf { LightSettings }

// Exported because launchers start it; any app could too, so the screen stays out of screenshots and Recents and
// ignores taps that pass through an overlay, which could otherwise re-point a widget at another of the user's accounts.
class WidgetConfigActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
    window.decorView.filterTouchesWhenObscured = true
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
    val saveLabel = if (config.isConfigured(appWidgetId)) R.string.options_save else R.string.options_add_widget

    setContent {
      val isDark = isSystemInDarkTheme()
      val colors = if (isDark) DarkSettings else LightSettings
      val scheme = if (isDark) darkColorScheme(primary = colors.ink) else lightColorScheme(primary = colors.ink)
      MaterialTheme(colorScheme = scheme) {
        CompositionLocalProvider(LocalSettingsColors provides colors) {
          Surface(Modifier.fillMaxSize(), color = colors.background) {
            when (kind) {
              WidgetKind.Portfolio -> PortfolioSettings(config.portfolio(appWidgetId), snapshot, saveLabel) {
                config.save(appWidgetId, it)
                finishConfigured(appWidgetId, provider)
              }
              WidgetKind.Price -> PriceSettings(config.price(appWidgetId), snapshot, saveLabel) {
                config.save(appWidgetId, it)
                finishConfigured(appWidgetId, provider)
              }
              WidgetKind.Receive -> ReceiveSettings(config.receive(appWidgetId), snapshot, saveLabel) {
                config.save(appWidgetId, it)
                finishConfigured(appWidgetId, provider)
              }
              WidgetKind.Transactions -> TransactionsSettings(config.transactions(appWidgetId), snapshot, saveLabel) {
                config.save(appWidgetId, it)
                finishConfigured(appWidgetId, provider)
              }
              WidgetKind.PortfolioTabs -> PortfolioSettings(
                config.portfolio(appWidgetId),
                snapshot,
                saveLabel,
                R.string.portfolio_tabs_name,
                R.string.portfolio_tabs_description,
              ) {
                config.save(appWidgetId, it)
                finishConfigured(appWidgetId, provider)
              }
            }
          }
        }
      }
    }
  }

  // The host sends no APPWIDGET_UPDATE after a configure. The broadcast lets Glance and the receiver handle it as
  // one; the redraw and fetch make a live session show the new options.
  private fun finishConfigured(appWidgetId: Int, provider: ComponentName) {
    WidgetUpdater.reconfigured(this, appWidgetId)
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
private fun PortfolioSettings(
  initial: PortfolioOptions,
  snapshot: WidgetSnapshot?,
  saveLabel: Int,
  title: Int = R.string.portfolio_name,
  description: Int = R.string.portfolio_description,
  onSave: (PortfolioOptions) -> Unit,
) {
  var options by remember { mutableStateOf(initial) }
  SettingsPage(title, description, saveLabel, { onSave(options) }) {
    ChoiceRow(R.string.options_chart_period, WidgetChoices.periods, options.period) { options = options.copy(period = it) }
    ToggleRow(R.string.options_show_chart, options.showChart) { options = options.copy(showChart = it) }
    ChoiceRow(R.string.options_account, WidgetChoices.portfolioAccounts(snapshot), options.accountAddress) {
      options = options.copy(accountAddress = it)
    }
  }
}

@Composable
private fun PriceSettings(initial: PriceOptions, snapshot: WidgetSnapshot?, saveLabel: Int, onSave: (PriceOptions) -> Unit) {
  var options by remember { mutableStateOf(initial.copy(assetId = resolvePriceAssetId(initial, snapshot))) }
  val currencies by produceState<List<FetchedCurrency>?>(initialValue = null, snapshot) {
    val feed = snapshot?.priceFeed ?: return@produceState
    value = withContext(Dispatchers.IO) { CurrenciesFetcher(Http.client(feed)).fetch(feed) }
  }
  SettingsPage(R.string.price_name, R.string.price_description, saveLabel, { onSave(options) }) {
    ChoiceRow(R.string.options_asset, WidgetChoices.assets(snapshot), options.assetId) { options = options.copy(assetId = it) }
    ChoiceRow(R.string.options_currency, WidgetChoices.currencies(currencies, options.currencyCode), options.currencyCode) {
      options = options.copy(currencyCode = it)
    }
    ChoiceRow(R.string.options_chart_period, WidgetChoices.periods, options.period) { options = options.copy(period = it) }
    ToggleRow(R.string.options_show_inverse, options.showAssetPerCurrency) { options = options.copy(showAssetPerCurrency = it) }
  }
}

@Composable
private fun ReceiveSettings(initial: ReceiveOptions, snapshot: WidgetSnapshot?, saveLabel: Int, onSave: (ReceiveOptions) -> Unit) {
  var options by remember { mutableStateOf(initial) }
  val choices = WidgetChoices.receiveAccounts(snapshot)
  val selected = resolveReceiveTarget(options, snapshot)?.address
  SettingsPage(R.string.receive_name, R.string.receive_description, saveLabel, { onSave(options) }) {
    ChoiceRow(R.string.options_account, choices, selected) { options = options.copy(accountAddress = it) }
  }
}

@Composable
private fun TransactionsSettings(
  initial: TransactionsOptions,
  snapshot: WidgetSnapshot?,
  saveLabel: Int,
  onSave: (TransactionsOptions) -> Unit,
) {
  var options by remember { mutableStateOf(initial) }
  SettingsPage(R.string.transactions_name, R.string.transactions_description, saveLabel, { onSave(options) }) {
    ChoiceRow(R.string.options_account, WidgetChoices.portfolioAccounts(snapshot), options.accountAddress) {
      options = options.copy(accountAddress = it)
    }
  }
}

@Composable
private fun SettingsPage(title: Int, description: Int, saveLabel: Int, onSave: () -> Unit, rows: @Composable () -> Unit) {
  val colors = LocalSettingsColors.current
  Column(
    Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp, vertical = 32.dp),
  ) {
    Text(stringResource(title), fontSize = 18.sp, fontWeight = FontWeight.Bold, color = colors.ink)
    Text(stringResource(description), fontSize = 13.sp, color = colors.muted, modifier = Modifier.padding(bottom = 10.dp))
    rows()
    Button(
      onClick = onSave,
      modifier = Modifier.fillMaxWidth().padding(top = 22.dp),
      shape = RoundedCornerShape(percent = 50),
      colors = ButtonDefaults.buttonColors(containerColor = colors.ink, contentColor = colors.background),
      contentPadding = PaddingValues(vertical = 14.dp),
    ) {
      Text(stringResource(saveLabel), fontWeight = FontWeight.Medium)
    }
    Text(
      stringResource(R.string.options_hint),
      fontSize = 12.sp,
      color = colors.muted,
      textAlign = TextAlign.Center,
      modifier = Modifier.fillMaxWidth().padding(top = 14.dp),
    )
  }
}

@Composable
private fun <T> ChoiceRow(label: Int, choices: List<Choice<T>>, selected: T, onSelect: (T) -> Unit) {
  val colors = LocalSettingsColors.current
  var expanded by remember { mutableStateOf(false) }
  val current = choices.firstOrNull { it.value == selected } ?: choices.firstOrNull()
  Box {
    Row(
      Modifier.fillMaxWidth().clickable { expanded = true }.padding(horizontal = 4.dp, vertical = 14.dp),
      horizontalArrangement = Arrangement.SpaceBetween,
      verticalAlignment = Alignment.CenterVertically,
    ) {
      Text(stringResource(label), fontSize = 14.sp, fontWeight = FontWeight.Medium, color = colors.muted)
      Text(current?.let { choiceText(it) }.orEmpty(), fontSize = 14.sp, color = colors.ink)
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
  HorizontalDivider(color = colors.line)
}

@Composable
private fun choiceText(choice: Choice<*>): String = choice.label ?: choice.labelRes?.let { stringResource(it) }.orEmpty()

@Composable
private fun ToggleRow(label: Int, checked: Boolean, onChange: (Boolean) -> Unit) {
  val colors = LocalSettingsColors.current
  Row(
    Modifier.fillMaxWidth().padding(horizontal = 4.dp),
    horizontalArrangement = Arrangement.SpaceBetween,
    verticalAlignment = Alignment.CenterVertically,
  ) {
    Text(stringResource(label), fontSize = 14.sp, fontWeight = FontWeight.Medium, color = colors.muted)
    Switch(checked = checked, onCheckedChange = onChange)
  }
  HorizontalDivider(color = colors.line)
}
