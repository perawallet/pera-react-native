"use strict";
/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fromSeed = fromSeed;
exports.trunc_256_minus_g_bits = trunc_256_minus_g_bits;
exports.deriveChildNodePrivate = deriveChildNodePrivate;
exports.deriveChildNodePublic = deriveChildNodePublic;
var crypto_1 = require("crypto");
var sumo_1 = require("./sumo");
var bn_js_1 = require("bn.js");
var util = require("util");
/**
 *
 * Reference of BIP32-Ed25519 Hierarchical Deterministic Keys over a Non-linear Keyspace (https://acrobat.adobe.com/id/urn:aaid:sc:EU:04fe29b0-ea1a-478b-a886-9bb558a5242a)
 *
 * @see section V. BIP32-Ed25519: Specification;
 *
 * A) Root keys
 *
 * @param seed - 256 bite seed generated from BIP39 Mnemonic
 * @returns - Extended root key (kL, kR, c) where kL is the left 32 bytes of the root key, kR is the right 32 bytes of the root key, and c is the chain code. Total 96 bytes
 */
function fromSeed(seed) {
    // k = H512(seed)
    var k = (0, crypto_1.createHash)('sha512').update(seed).digest();
    var kL = k.subarray(0, 32);
    var kR = k.subarray(32, 64);
    // While the third highest bit of the last byte of kL is not zero
    while ((kL[31] & 32) !== 0) {
        k = (0, crypto_1.createHmac)('sha512', kL).update(kR).digest();
        kL = k.subarray(0, 32);
        kR = k.subarray(32, 64);
    }
    // clamp
    //Set the bits in kL as follows:
    // little Endianess
    kL[0] &= 248; // the lowest 3 bits of the first byte of kL are cleared
    kL[31] &= 127; // the highest bit of the last byte is cleared
    kL[31] |= 64; // the second highest bit of the last byte is set
    // chain root code
    // SHA256(0x01||k)
    var c = (0, crypto_1.createHash)('sha256')
        .update(Buffer.concat([new Uint8Array([0x01]), seed]))
        .digest();
    return new Uint8Array(Buffer.concat([kL, kR, c]));
}
/**
 * This function takes an array of up to 256 bits and sets the last g trailing bits to zero
 *
 * @param array - An array of up to 256 bits
 * @param g - The number of bits to zero
 * @returns - The array with the last g bits set to zero
 */
function trunc_256_minus_g_bits(array, g) {
    if (g < 0 || g > 256) {
        throw new Error('Number of bits to zero must be between 0 and 256.');
    }
    // make a copy of array
    var truncated = new Uint8Array(array);
    var remainingBits = g;
    // Start from the last byte and move backward
    for (var i = truncated.length - 1; i >= 0 && remainingBits > 0; i--) {
        if (remainingBits >= 8) {
            // If more than 8 bits remain to be zeroed, zero the entire byte
            truncated[i] = 0;
            remainingBits -= 8;
        }
        else {
            // Zero out the most significant bits
            truncated[i] &= 0xff >> remainingBits;
            break;
        }
    }
    return truncated;
}
/**
 * @see section V. BIP32-Ed25519: Specification;
 *
 * subsections:
 *
 * B) Child Keys
 * and
 * C) Private Child Key Derivation
 *
 * @param extendedKey - extended key (kL, kR, c) where kL is the left 32 bytes of the root key the scalar (pvtKey). kR is the right 32 bytes of the root key, and c is the chain code. Total 96 bytes
 * @param index - index of the child key
 * @param g - Defines how many bits to zero in the left 32 bytes of the child key. Standard BIP32-ed25519 derivations use 32 bits.
 * @returns - (kL, kR, c) where kL is the left 32 bytes of the child key (the new scalar), kR is the right 32 bytes of the child key, and c is the chain code. Total 96 bytes
 */
function deriveChildNodePrivate(extendedKey_1, index_1) {
    return __awaiter(this, arguments, void 0, function (extendedKey, index, g) {
        var kL, kR, cc, _a, z, childChainCode, _b, zLeft, zRight, zL, klBigNum, big8, zlBigNum, zlBigNumMul8, left, right, rightBuffer;
        if (g === void 0) { g = 9; }
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    kL = Buffer.from(extendedKey.subarray(0, 32));
                    kR = Buffer.from(extendedKey.subarray(32, 64));
                    cc = extendedKey.subarray(64, 96);
                    if (!(index < 0x80000000)) return [3 /*break*/, 2];
                    return [4 /*yield*/, derivedNonHardened(kL, cc, index)];
                case 1:
                    _b = _c.sent();
                    return [3 /*break*/, 3];
                case 2:
                    _b = deriveHardened(kL, kR, cc, index);
                    _c.label = 3;
                case 3:
                    _a = _b, z = _a.z, childChainCode = _a.childChainCode;
                    zLeft = z.subarray(0, 32) // 32 bytes
                    ;
                    zRight = z.subarray(32, 64);
                    zL = trunc_256_minus_g_bits(zLeft, g);
                    klBigNum = new bn_js_1.default(kL, 16, 'le');
                    big8 = new bn_js_1.default(8);
                    zlBigNum = new bn_js_1.default(zL, 16, 'le');
                    zlBigNumMul8 = klBigNum.add(zlBigNum.mul(big8));
                    // check if zlBigNumMul8 is equal or larger than 2^255
                    if (zlBigNumMul8.cmp(new bn_js_1.default(2).pow(new bn_js_1.default(255))) >= 0) {
                        console.log(util.inspect(zlBigNumMul8), { colors: true, depth: null });
                        throw new Error('zL * 8 is larger than 2^255, which is not safe');
                    }
                    left = klBigNum.add(zlBigNum.mul(big8)).toArrayLike(Buffer, 'le', 32);
                    right = new bn_js_1.default(kR, 16, 'le')
                        .add(new bn_js_1.default(zRight, 16, 'le'))
                        .toArrayLike(Buffer, 'le')
                        .slice(0, 32);
                    rightBuffer = Buffer.alloc(32);
                    Buffer.from(right).copy(rightBuffer, 0, 0, right.length); // padding with zeros if needed
                    // return (kL, kR, c)
                    return [2 /*return*/, new Uint8Array(Buffer.concat([left, rightBuffer, childChainCode]))];
            }
        });
    });
}
/**
 *  * @see section V. BIP32-Ed25519: Specification;
 *
 * subsections:
 *
 * D) Public Child key
 *
 * @param extendedKey - extend public key (p, c) where p is the public key and c is the chain code. Total 64 bytes
 * @param index - unharden index (i < 2^31) of the child key
 * @param g - Defines how many bits to zero in the left 32 bytes of the child key. Standard BIP32-ed25519 derivations use 32 bits.
 * @returns - 64 bytes, being the 32 bytes of the child key (the new public key) followed by the 32 bytes of the chain code
 */
function deriveChildNodePublic(extendedKey_1, index_1) {
    return __awaiter(this, arguments, void 0, function (extendedKey, index, g) {
        var pk, cc, data, z, zL, _a, crypto_scalarmult_ed25519_base_noclamp, crypto_core_ed25519_add, left, p, fullChildChainCode, childChainCode;
        if (g === void 0) { g = 9; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (index > 0x80000000)
                        throw new Error('can not derive public key with harden');
                    pk = Buffer.from(extendedKey.subarray(0, 32));
                    cc = Buffer.from(extendedKey.subarray(32, 64));
                    data = Buffer.allocUnsafe(1 + 32 + 4);
                    data.writeUInt32LE(index, 1 + 32);
                    pk.copy(data, 1);
                    // Step 1: Compute Z
                    data[0] = 0x02;
                    z = (0, crypto_1.createHmac)('sha512', cc).update(data).digest();
                    zL = trunc_256_minus_g_bits(z.subarray(0, 32), g);
                    return [4 /*yield*/, (0, sumo_1.default)()];
                case 1:
                    _a = _b.sent(), crypto_scalarmult_ed25519_base_noclamp = _a.crypto_scalarmult_ed25519_base_noclamp, crypto_core_ed25519_add = _a.crypto_core_ed25519_add;
                    left = new bn_js_1.default(zL, 16, 'le')
                        .mul(new bn_js_1.default(8))
                        .toArrayLike(Buffer, 'le', 32);
                    p = crypto_scalarmult_ed25519_base_noclamp(left);
                    // Step 3: Compute child chain code
                    data[0] = 0x03;
                    fullChildChainCode = (0, crypto_1.createHmac)('sha512', cc)
                        .update(data)
                        .digest();
                    childChainCode = fullChildChainCode.subarray(32, 64);
                    return [2 /*return*/, new Uint8Array(Buffer.concat([crypto_core_ed25519_add(p, pk), childChainCode]))];
            }
        });
    });
}
/**
 *
 * @see section V. BIP32-Ed25519: Specification
 *
 * @param kl - The scalar
 * @param cc - chain code
 * @param index - non-hardened ( < 2^31 ) index
 * @returns - (z, c) where z is the 64-byte child key and c is the chain code
 */
function derivedNonHardened(kl, cc, index) {
    return __awaiter(this, void 0, void 0, function () {
        var data, crypto_scalarmult_ed25519_base_noclamp, pk, z, fullChildChainCode, childChainCode;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    data = Buffer.allocUnsafe(1 + 32 + 4);
                    data.writeUInt32LE(index, 1 + 32);
                    return [4 /*yield*/, (0, sumo_1.default)()];
                case 1:
                    crypto_scalarmult_ed25519_base_noclamp = (_a.sent()).crypto_scalarmult_ed25519_base_noclamp;
                    pk = Buffer.from(crypto_scalarmult_ed25519_base_noclamp(kl));
                    pk.copy(data, 1);
                    data[0] = 0x02;
                    z = (0, crypto_1.createHmac)('sha512', cc).update(data).digest();
                    data[0] = 0x03;
                    fullChildChainCode = (0, crypto_1.createHmac)('sha512', cc)
                        .update(data)
                        .digest();
                    childChainCode = fullChildChainCode.subarray(32, 64);
                    return [2 /*return*/, { z: z, childChainCode: childChainCode }];
            }
        });
    });
}
/**
 *
 * @see section V. BIP32-Ed25519: Specification
 *
 * @param kl - The scalar (a.k.a private key)
 * @param kr - the right 32 bytes of the root key
 * @param cc - chain code
 * @param index - hardened ( >= 2^31 ) index
 * @returns - (z, c) where z is the 64-byte child key and c is the chain code
 */
function deriveHardened(kl, kr, cc, index) {
    var data = Buffer.allocUnsafe(1 + 64 + 4);
    data.writeUInt32LE(index, 1 + 64);
    Buffer.from(kl).copy(data, 1);
    Buffer.from(kr).copy(data, 1 + 32);
    data[0] = 0x00;
    var z = (0, crypto_1.createHmac)('sha512', cc).update(data).digest();
    data[0] = 0x01;
    var fullChildChainCode = (0, crypto_1.createHmac)('sha512', cc)
        .update(data)
        .digest();
    var childChainCode = fullChildChainCode.subarray(32, 64);
    return { z: z, childChainCode: childChainCode };
}
