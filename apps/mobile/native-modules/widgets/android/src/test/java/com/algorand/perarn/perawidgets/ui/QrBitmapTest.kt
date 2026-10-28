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

import com.google.zxing.BinaryBitmap
import com.google.zxing.LuminanceSource
import com.google.zxing.common.BitMatrix
import com.google.zxing.common.HybridBinarizer
import com.google.zxing.qrcode.QRCodeReader
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

private const val SCALE = 4

private class MatrixSource(private val matrix: BitMatrix) : LuminanceSource(matrix.width * SCALE, matrix.height * SCALE) {
    private fun luminance(x: Int, y: Int): Byte = if (matrix[x / SCALE, y / SCALE]) 0 else 255.toByte()

    override fun getRow(y: Int, row: ByteArray?): ByteArray {
        val out = if (row != null && row.size >= width) row else ByteArray(width)
        for (x in 0 until width) out[x] = luminance(x, y)
        return out
    }

    override fun getMatrix(): ByteArray = ByteArray(width * height).also { out ->
        for (y in 0 until height) for (x in 0 until width) out[y * width + x] = luminance(x, y)
    }
}

class QrBitmapTest {
    private fun decode(matrix: BitMatrix) = QRCodeReader().decode(BinaryBitmap(HybridBinarizer(MatrixSource(matrix)))).text

    @Test
    fun encodesThePaymentUriExactly() {
        val uri = "algorand://ABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ2345?amount=1000000&asset=31566704&label=Caf%C3%A9"
        assertEquals(uri, decode(qrMatrix(uri)))
    }

    @Test
    fun keepsAWhiteQuietZone() {
        val matrix = qrMatrix("algorand://ABC")
        for (i in 0 until matrix.width) {
            for (edge in 0 until 4) {
                assertFalse(matrix[i, edge])
                assertFalse(matrix[edge, i])
                assertFalse(matrix[i, matrix.height - 1 - edge])
                assertFalse(matrix[matrix.width - 1 - edge, i])
            }
        }
    }
}
