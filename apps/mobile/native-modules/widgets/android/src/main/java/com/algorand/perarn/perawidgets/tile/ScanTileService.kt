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
package com.algorand.perarn.perawidgets.tile

import android.app.PendingIntent
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService

private const val SCAN_URL = "perawallet://app/scan/"

// "Scan with Pera" in Quick Settings, the Android twin of the iOS Control Center control. It opens the same
// link the app's quick action does, so a locked app shows the PIN first and the scanner after it.
class ScanTileService : TileService() {
    override fun onStartListening() {
        super.onStartListening()
        qsTile?.apply {
            state = Tile.STATE_INACTIVE
            updateTile()
        }
    }

    override fun onClick() {
        super.onClick()
        // From the lock screen the phone is unlocked first, rather than opening a wallet over the keyguard.
        if (isLocked) unlockAndRun { openScanner() } else openScanner()
    }

    private fun openScanner() {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(SCAN_URL))
            .setPackage(packageName)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startActivityAndCollapse(
                PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT),
            )
        } else {
            // The Intent overload throws from API 34; below it, it is the only one.
            @Suppress("DEPRECATION")
            startActivityAndCollapse(intent)
        }
    }
}
