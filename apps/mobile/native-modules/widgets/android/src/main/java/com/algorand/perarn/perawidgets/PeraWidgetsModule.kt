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
package com.algorand.perarn.perawidgets

import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import com.algorand.perarn.perawidgets.refresh.WidgetUpdater
import com.algorand.perarn.perawidgets.refresh.shouldRedraw
import com.algorand.perarn.perawidgets.snapshot.SnapshotStore
import java.io.File
import kotlinx.coroutines.launch

private const val IMAGES_FOLDER = "widgets"

class PeraWidgetsModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext)

  private val imagesDirectory: File
    get() = File(context.filesDir, IMAGES_FOLDER)

  private fun redrawAll() {
    val appContext = context.applicationContext
    WidgetUpdater.scope.launch { WidgetUpdater.updateAll(appContext) }
  }

  override fun definition() = ModuleDefinition {
    Name("PeraWidgets")

    // Declared for parity with iOS, where the Scan control emits it; never sent here.
    Events("onScanRequested")

    AsyncFunction("writeSnapshot") { json: String ->
      val store = SnapshotStore(context)
      val previous = store.raw()
      store.write(json)
      if (shouldRedraw(previous, json)) redrawAll()
    }

    // Every clear commits before returning, so a wipe survives the app being closed straight after.
    AsyncFunction("clearSnapshot") {
      SnapshotStore(context).clear()
      imagesDirectory.deleteRecursively()
      WidgetUpdater.clearWalletData(context)
      val appContext = context.applicationContext
      // Wiped again under the fetch lock: a fetch already in flight would otherwise store its quote after this.
      WidgetUpdater.scope.launch {
        WidgetUpdater.forgetWalletData(appContext)
        WidgetUpdater.updateAll(appContext)
      }
    }

    // No Android widget renders images yet, so nothing is downloaded: report
    // only what is already on disk to keep the snapshot honest.
    // The Scan control is iOS-only.
    AsyncFunction("consumePendingScan") { false }

    AsyncFunction("syncImages") { items: List<Map<String, String>> ->
      items.mapNotNull { it["key"] }
        .filter { File(imagesDirectory, "nft-$it.jpg").exists() }
    }
  }
}
