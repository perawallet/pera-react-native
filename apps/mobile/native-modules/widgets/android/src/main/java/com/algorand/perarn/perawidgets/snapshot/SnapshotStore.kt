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
package com.algorand.perarn.perawidgets.snapshot

import android.content.Context

private const val PREFERENCES = "pera_widgets"
private const val SNAPSHOT_KEY = "snapshot"

// Reads what PeraWidgetsModule.writeSnapshot stores; change both together.
class SnapshotStore(private val context: Context) {
  fun load(): WidgetSnapshot? =
    WidgetSnapshots.decode(
      context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).getString(SNAPSHOT_KEY, null),
    )
}
