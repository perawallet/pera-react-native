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

import android.graphics.Bitmap
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.common.BitMatrix
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel

// One module, as iOS's generator: the white frame the widget draws around the code makes up the rest.
private const val QUIET_ZONE_MODULES = 1
private const val PIXELS_PER_MODULE = 8
private const val BLACK = 0xFF000000.toInt()
private const val WHITE = 0xFFFFFFFF.toInt()

fun qrMatrix(payload: String): BitMatrix = QRCodeWriter().encode(
    payload,
    BarcodeFormat.QR_CODE,
    0,
    0,
    mapOf(
        EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.M,
        EncodeHintType.MARGIN to QUIET_ZONE_MODULES,
        EncodeHintType.CHARACTER_SET to "UTF-8",
    ),
)

// Responsive mode composes once per listed size, each with its own remember: one encode serves them all.
object QrBitmaps {
    private var payload: String? = null
    private var bitmap: Bitmap? = null

    @Synchronized
    fun forPayload(payload: String): Bitmap {
        bitmap?.takeIf { this.payload == payload }?.let { return it }
        return qrBitmap(payload).also {
            this.payload = payload
            bitmap = it
        }
    }
}

// Whole pixels per module and no smoothing keep the modules sharp at any widget size.
fun qrBitmap(payload: String): Bitmap {
    val matrix = qrMatrix(payload)
    val side = matrix.width * PIXELS_PER_MODULE
    val pixels = IntArray(side * side)
    for (y in 0 until side) {
        for (x in 0 until side) {
            pixels[y * side + x] = if (matrix[x / PIXELS_PER_MODULE, y / PIXELS_PER_MODULE]) BLACK else WHITE
        }
    }
    return Bitmap.createBitmap(pixels, side, side, Bitmap.Config.ARGB_8888)
}
