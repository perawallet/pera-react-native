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
// NOTE - these tests do not currently run or pass using vite.  More investigation is needed!
var vitest_1 = require("vitest");
var bip39 = require("bip39");
var crypto_1 = require("crypto");
var x_hd_wallet_api_crypto_1 = require("../x.hd.wallet.api.crypto");
var msgpack = require("algo-msgpack-with-bigint");
var bip32_ed25519_impl_1 = require("../bip32-ed25519-impl");
var js_sha512_1 = require("js-sha512");
var hi_base32_1 = require("hi-base32");
var fs_1 = require("fs");
var node_path_1 = require("node:path");
var tweetnacl_1 = require("tweetnacl");
//@ts-expect-error, no types found
var otherLibBip32Ed25519 = require("bip32-ed25519");
var node_url_1 = require("node:url");
var sumo_1 = require("../sumo");
var __dirname = node_path_1.default.dirname((0, node_url_1.fileURLToPath)(import.meta.url));
function encodeAddress(publicKey) {
    var keyHash = js_sha512_1.sha512_256.create().update(publicKey).hex();
    // last 4 bytes of the hash
    var checksum = keyHash.slice(-8);
    return hi_base32_1.default
        .encode(ConcatArrays(publicKey, Buffer.from(checksum, 'hex')))
        .slice(0, 58);
}
function ConcatArrays() {
    var arrs = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        arrs[_i] = arguments[_i];
    }
    var size = arrs.reduce(function (sum, arr) { return sum + arr.length; }, 0);
    var c = new Uint8Array(size);
    var offset = 0;
    for (var i = 0; i < arrs.length; i++) {
        c.set(arrs[i], offset);
        offset += arrs[i].length;
    }
    return c;
}
(0, vitest_1.describe)('Contextual Derivation & Signing', function () {
    var cryptoService;
    var bip39Mnemonic = 'salon zoo engage submit smile frost later decide wing sight chaos renew lizard rely canal coral scene hobby scare step bus leaf tobacco slice';
    var rootKey;
    (0, vitest_1.beforeAll)(function () {
        rootKey = (0, bip32_ed25519_impl_1.fromSeed)(bip39.mnemonicToSeedSync(bip39Mnemonic, ''));
    });
    (0, vitest_1.beforeEach)(function () {
        cryptoService = new x_hd_wallet_api_crypto_1.XHDWalletAPI();
    });
    (0, vitest_1.afterEach)(function () { });
    /**
     * Testing against other known bip32-ed25519 lib that complies with the BIP32-Ed25519 specification
     *
     * @see BIP32-ed25519 Hierarchical Deterministic Keys over a Non-linear Keyspace (https://acrobat.adobe.com/id/urn:aaid:sc:EU:04fe29b0-ea1a-478b-a886-9bb558a5242a)
     *
     * We call the traditional derivation Khovratovich
     */
    (0, vitest_1.describe)('\(JS Library) Reference Implementation alignment with known BIP32-Ed25519 JS LIB', function () {
        (0, vitest_1.test)("\(OK) BIP32-Ed25519 derive key m'/44'/283'/0'/0/0", function () { return __awaiter(void 0, void 0, void 0, function () {
            var key, derivedKey, scalar, crypto_scalarmult_ed25519_base_noclamp, derivedPub;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, cryptoService.keyGen(rootKey, x_hd_wallet_api_crypto_1.KeyContexts.Address, 0, 0, x_hd_wallet_api_crypto_1.BIP32DerivationTypes.Khovratovich)];
                    case 1:
                        key = _a.sent();
                        derivedKey = otherLibBip32Ed25519.derivePrivate(Buffer.from(rootKey), (0, x_hd_wallet_api_crypto_1.harden)(44));
                        derivedKey = otherLibBip32Ed25519.derivePrivate(derivedKey, (0, x_hd_wallet_api_crypto_1.harden)(283));
                        derivedKey = otherLibBip32Ed25519.derivePrivate(derivedKey, (0, x_hd_wallet_api_crypto_1.harden)(0));
                        derivedKey = otherLibBip32Ed25519.derivePrivate(derivedKey, 0);
                        derivedKey = otherLibBip32Ed25519.derivePrivate(derivedKey, 0);
                        scalar = derivedKey.subarray(0, 32) // scalar == pvtKey
                        ;
                        return [4 /*yield*/, (0, sumo_1.default)()];
                    case 2:
                        crypto_scalarmult_ed25519_base_noclamp = (_a.sent()).crypto_scalarmult_ed25519_base_noclamp;
                        derivedPub = crypto_scalarmult_ed25519_base_noclamp(scalar) // calculate public key
                        ;
                        return [4 /*yield*/, (0, vitest_1.expect)(derivedPub).toEqual(key)];
                    case 3:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.test)("\(OK) BIP32-Ed25519 derive key m'/44'/283'/0'/0/1", function () { return __awaiter(void 0, void 0, void 0, function () {
            var key, derivedKey, scalar, crypto_scalarmult_ed25519_base_noclamp, derivedPub;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, cryptoService.keyGen(rootKey, x_hd_wallet_api_crypto_1.KeyContexts.Address, 0, 1, x_hd_wallet_api_crypto_1.BIP32DerivationTypes.Khovratovich)];
                    case 1:
                        key = _a.sent();
                        derivedKey = otherLibBip32Ed25519.derivePrivate(Buffer.from(rootKey), (0, x_hd_wallet_api_crypto_1.harden)(44));
                        derivedKey = otherLibBip32Ed25519.derivePrivate(derivedKey, (0, x_hd_wallet_api_crypto_1.harden)(283));
                        derivedKey = otherLibBip32Ed25519.derivePrivate(derivedKey, (0, x_hd_wallet_api_crypto_1.harden)(0));
                        derivedKey = otherLibBip32Ed25519.derivePrivate(derivedKey, 0);
                        derivedKey = otherLibBip32Ed25519.derivePrivate(derivedKey, 1);
                        scalar = derivedKey.subarray(0, 32) // scalar == pvtKey
                        ;
                        return [4 /*yield*/, (0, sumo_1.default)()];
                    case 2:
                        crypto_scalarmult_ed25519_base_noclamp = (_a.sent()).crypto_scalarmult_ed25519_base_noclamp;
                        derivedPub = crypto_scalarmult_ed25519_base_noclamp(scalar) // calculate public key
                        ;
                        return [4 /*yield*/, (0, vitest_1.expect)(derivedPub).toEqual(key)];
                    case 3:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.test)("\(OK) BIP32-Ed25519 derive PUBLIC key m'/44'/283'/1'/0/1", function () { return __awaiter(void 0, void 0, void 0, function () {
            var key, derivedKey, nodeScalar, crypto_scalarmult_ed25519_base_noclamp, nodePublic, nodeCC, extPub, derivedPub;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, cryptoService.keyGen(rootKey, x_hd_wallet_api_crypto_1.KeyContexts.Address, 1, 1, x_hd_wallet_api_crypto_1.BIP32DerivationTypes.Khovratovich)];
                    case 1:
                        key = _a.sent();
                        derivedKey = otherLibBip32Ed25519.derivePrivate(Buffer.from(rootKey), (0, x_hd_wallet_api_crypto_1.harden)(44));
                        derivedKey = otherLibBip32Ed25519.derivePrivate(derivedKey, (0, x_hd_wallet_api_crypto_1.harden)(283));
                        derivedKey = otherLibBip32Ed25519.derivePrivate(derivedKey, (0, x_hd_wallet_api_crypto_1.harden)(1));
                        nodeScalar = derivedKey.subarray(0, 32);
                        return [4 /*yield*/, (0, sumo_1.default)()];
                    case 2:
                        crypto_scalarmult_ed25519_base_noclamp = (_a.sent()).crypto_scalarmult_ed25519_base_noclamp;
                        nodePublic = crypto_scalarmult_ed25519_base_noclamp(nodeScalar);
                        nodeCC = derivedKey.subarray(64, 96);
                        extPub = Buffer.concat([nodePublic, nodeCC]);
                        derivedKey = otherLibBip32Ed25519.derivePublic(extPub, 0);
                        derivedKey = otherLibBip32Ed25519.derivePublic(derivedKey, 1);
                        derivedPub = new Uint8Array(derivedKey.subarray(0, 32)) // public key from extended format
                        ;
                        return [4 /*yield*/, (0, vitest_1.expect)(derivedPub).toEqual(key)];
                    case 3:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.test)("\(OK) BIP32-Ed25519 derive PUBLIC key m'/44'/0'/1'/0/2", function () { return __awaiter(void 0, void 0, void 0, function () {
            var key, derivedKey, nodeScalar, crypto_scalarmult_ed25519_base_noclamp, nodePublic, nodeCC, extPub, derivedPub;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, cryptoService.keyGen(rootKey, x_hd_wallet_api_crypto_1.KeyContexts.Identity, 1, 2, x_hd_wallet_api_crypto_1.BIP32DerivationTypes.Khovratovich)];
                    case 1:
                        key = _a.sent();
                        derivedKey = otherLibBip32Ed25519.derivePrivate(Buffer.from(rootKey), (0, x_hd_wallet_api_crypto_1.harden)(44));
                        derivedKey = otherLibBip32Ed25519.derivePrivate(derivedKey, (0, x_hd_wallet_api_crypto_1.harden)(0));
                        derivedKey = otherLibBip32Ed25519.derivePrivate(derivedKey, (0, x_hd_wallet_api_crypto_1.harden)(1));
                        nodeScalar = derivedKey.subarray(0, 32);
                        return [4 /*yield*/, (0, sumo_1.default)()];
                    case 2:
                        crypto_scalarmult_ed25519_base_noclamp = (_a.sent()).crypto_scalarmult_ed25519_base_noclamp;
                        nodePublic = crypto_scalarmult_ed25519_base_noclamp(nodeScalar);
                        nodeCC = derivedKey.subarray(64, 96);
                        extPub = Buffer.concat([nodePublic, nodeCC]);
                        derivedKey = otherLibBip32Ed25519.derivePublic(extPub, 0);
                        derivedKey = otherLibBip32Ed25519.derivePublic(derivedKey, 2);
                        derivedPub = new Uint8Array(derivedKey.subarray(0, 32)) // public key from extended format
                        ;
                        return [4 /*yield*/, (0, vitest_1.expect)(derivedPub).toEqual(key)];
                    case 3:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.test)('\(OK) Root Key', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, vitest_1.expect)(rootKey.length).toBe(96)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, vitest_1.expect)(Buffer.from(rootKey)).toEqual(Buffer.from('a8ba80028922d9fcfa055c78aede55b5c575bcd8d5a53168edf45f36d9ec8f4694592b4bc892907583e22669ecdf1b0409a9f3bd5549f2dd751b51360909cd05796b9206ec30e142e94b790a98805bf999042b55046963174ee6cee2d0375946', 'hex'))];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.describe)('\(Derivations) Context', function () {
        (0, vitest_1.describe)('Addresses', function () {
            (0, vitest_1.describe)('Soft Derivations', function () {
                (0, vitest_1.test)("\(OK) Derive m'/44'/283'/0'/0/0 Algorand Address Key", function () { return __awaiter(void 0, void 0, void 0, function () {
                    var key;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, cryptoService.keyGen(rootKey, x_hd_wallet_api_crypto_1.KeyContexts.Address, 0, 0)];
                            case 1:
                                key = _a.sent();
                                return [4 /*yield*/, (0, vitest_1.expect)(key).toEqual(new Uint8Array(Buffer.from('7bda7ac12627b2c259f1df6875d30c10b35f55b33ad2cc8ea2736eaa3ebcfab9', 'hex')))];
                            case 2:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
                (0, vitest_1.test)("\(OK) Derive m'/44'/283'/0'/0/1 Algorand Address Key", function () { return __awaiter(void 0, void 0, void 0, function () {
                    var key;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, cryptoService.keyGen(rootKey, x_hd_wallet_api_crypto_1.KeyContexts.Address, 0, 1)];
                            case 1:
                                key = _a.sent();
                                return [4 /*yield*/, (0, vitest_1.expect)(key).toEqual(new Uint8Array(Buffer.from('5bae8828f111064637ac5061bd63bc4fcfe4a833252305f25eeab9c64ecdf519', 'hex')))];
                            case 2:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
                (0, vitest_1.test)("\(OK) Derive m'/44'/283'/0'/0/2 Algorand Address Key", function () { return __awaiter(void 0, void 0, void 0, function () {
                    var key;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, cryptoService.keyGen(rootKey, x_hd_wallet_api_crypto_1.KeyContexts.Address, 0, 2)];
                            case 1:
                                key = _a.sent();
                                return [4 /*yield*/, (0, vitest_1.expect)(key).toEqual(new Uint8Array(Buffer.from('00a72635e97cba966529e9bfb4baf4a32d7b8cd2fcd8e2476ce5be1177848cb3', 'hex')))];
                            case 2:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
            });
            (0, vitest_1.describe)('Hard Derivations', function () {
                (0, vitest_1.test)("\(OK) Derive m'/44'/283'/1'/0/0 Algorand Address Key", function () { return __awaiter(void 0, void 0, void 0, function () {
                    var key;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, cryptoService.keyGen(rootKey, x_hd_wallet_api_crypto_1.KeyContexts.Address, 1, 0)];
                            case 1:
                                key = _a.sent();
                                return [4 /*yield*/, (0, vitest_1.expect)(key).toEqual(new Uint8Array(Buffer.from('358d8c4382992849a764438e02b1c45c2ca4e86bbcfe10fd5b963f3610012bc9', 'hex')))];
                            case 2:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
                (0, vitest_1.test)("\(OK) Derive m'/44'/283'/2'/0/1 Algorand Address Key", function () { return __awaiter(void 0, void 0, void 0, function () {
                    var key;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, cryptoService.keyGen(rootKey, x_hd_wallet_api_crypto_1.KeyContexts.Address, 2, 1)];
                            case 1:
                                key = _a.sent();
                                return [4 /*yield*/, (0, vitest_1.expect)(key).toEqual(new Uint8Array(Buffer.from('1f0f75fbbca12b22523973191061b2f96522740e139a3420c730717ac5b0dfc0', 'hex')))];
                            case 2:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
                (0, vitest_1.test)("\(OK) Derive m'/44'/283'/3'/0/0 Algorand Address Key", function () { return __awaiter(void 0, void 0, void 0, function () {
                    var key;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, cryptoService.keyGen(rootKey, x_hd_wallet_api_crypto_1.KeyContexts.Address, 3, 0)];
                            case 1:
                                key = _a.sent();
                                return [4 /*yield*/, (0, vitest_1.expect)(key).toEqual(new Uint8Array(Buffer.from('f035316f915b342ea5fe78dccb59d907b93805732219d436a1bd8488ff4e5b1b', 'hex')))];
                            case 2:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
            });
        });
        (0, vitest_1.describe)('Identities', function () {
            (0, vitest_1.describe)('Soft Derivations', function () {
                (0, vitest_1.test)("\(OK) Derive m'/44'/0'/0'/0/0 Identity Key", function () { return __awaiter(void 0, void 0, void 0, function () {
                    var key;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, cryptoService.keyGen(rootKey, x_hd_wallet_api_crypto_1.KeyContexts.Identity, 0, 0)];
                            case 1:
                                key = _a.sent();
                                return [4 /*yield*/, (0, vitest_1.expect)(key).toEqual(new Uint8Array(Buffer.from('ff8b1863ef5e40d0a48c245f26a6dbdf5da94dc75a1851f51d8a04e547bd5f5a', 'hex')))];
                            case 2:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
                (0, vitest_1.test)("\(OK) Derive m'/44'/0'/0'/0/1 Identity Key", function () { return __awaiter(void 0, void 0, void 0, function () {
                    var key;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, cryptoService.keyGen(rootKey, x_hd_wallet_api_crypto_1.KeyContexts.Identity, 0, 1)];
                            case 1:
                                key = _a.sent();
                                return [4 /*yield*/, (0, vitest_1.expect)(key).toEqual(new Uint8Array(Buffer.from('2b46c2af0890493e486049d456509a0199e565b41a5fb622f0ea4b9337bd2b97', 'hex')))];
                            case 2:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
                (0, vitest_1.test)("\(OK) Derive m'/44'/0'/0'/0/2 Identity Key", function () { return __awaiter(void 0, void 0, void 0, function () {
                    var key;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, cryptoService.keyGen(rootKey, x_hd_wallet_api_crypto_1.KeyContexts.Identity, 0, 2)];
                            case 1:
                                key = _a.sent();
                                return [4 /*yield*/, (0, vitest_1.expect)(key).toEqual(new Uint8Array(Buffer.from('2713f135f19ef3dcfca73cb536b1e077b1165cd0b7bedbef709447319ff0016d', 'hex')))];
                            case 2:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
            });
            (0, vitest_1.describe)('Hard Derivations', function () {
                (0, vitest_1.test)("\(OK) Derive m'/44'/0'/1'/0/0 Identity Key", function () { return __awaiter(void 0, void 0, void 0, function () {
                    var key;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, cryptoService.keyGen(rootKey, x_hd_wallet_api_crypto_1.KeyContexts.Identity, 1, 0)];
                            case 1:
                                key = _a.sent();
                                return [4 /*yield*/, (0, vitest_1.expect)(key).toEqual(new Uint8Array(Buffer.from('232847ae1bb95babcaa50c8033fab98f59e4b4ad1d89ac523a90c830e4ceee4a', 'hex')))];
                            case 2:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
                (0, vitest_1.test)("\(OK) Derive m'/44'/0'/2'/0/1 Identity Key", function () { return __awaiter(void 0, void 0, void 0, function () {
                    var key;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, cryptoService.keyGen(rootKey, x_hd_wallet_api_crypto_1.KeyContexts.Identity, 2, 1)];
                            case 1:
                                key = _a.sent();
                                return [4 /*yield*/, (0, vitest_1.expect)(key).toEqual(new Uint8Array(Buffer.from('8f68b6572860d84e8a41e38db1c8c692ded5eb291846f2e5bbfde774a9c6d16e', 'hex')))];
                            case 2:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
            });
        });
        (0, vitest_1.describe)('Signing Typed Data', function () {
            (0, vitest_1.test)('\(OK) Sign authentication challenge of 32 bytes, encoded base64', function () { return __awaiter(void 0, void 0, void 0, function () {
                var challenge, authSchema, metadata, base64Challenge, encoded, signature, isValid, _a, _b, _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            challenge = new Uint8Array((0, crypto_1.randomBytes)(32));
                            authSchema = JSON.parse((0, fs_1.readFileSync)(node_path_1.default.resolve(__dirname, '../../schemas/auth.request.json'), 'utf8'));
                            metadata = {
                                encoding: x_hd_wallet_api_crypto_1.Encodings.BASE64,
                                schema: authSchema,
                            };
                            base64Challenge = Buffer.from(challenge).toString('base64');
                            encoded = new Uint8Array(Buffer.from(base64Challenge));
                            return [4 /*yield*/, cryptoService.signData(rootKey, x_hd_wallet_api_crypto_1.KeyContexts.Address, 0, 0, encoded, metadata)];
                        case 1:
                            signature = _d.sent();
                            return [4 /*yield*/, (0, vitest_1.expect)(signature).toHaveLength(64)];
                        case 2:
                            _d.sent();
                            _b = (_a = cryptoService).verifyWithPublicKey;
                            _c = [signature,
                                encoded];
                            return [4 /*yield*/, cryptoService.keyGen(rootKey, x_hd_wallet_api_crypto_1.KeyContexts.Address, 0, 0)];
                        case 3: return [4 /*yield*/, _b.apply(_a, _c.concat([_d.sent()]))];
                        case 4:
                            isValid = _d.sent();
                            return [4 /*yield*/, (0, vitest_1.expect)(isValid).toBe(true)];
                        case 5:
                            _d.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            (0, vitest_1.test)('\(OK) Sign authentication challenge of 32 bytes, encoded msgpack', function () { return __awaiter(void 0, void 0, void 0, function () {
                var challenge, authSchema, metadata, encoded, signature, isValid, _a, _b, _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            challenge = new Uint8Array((0, crypto_1.randomBytes)(32));
                            authSchema = JSON.parse((0, fs_1.readFileSync)(node_path_1.default.resolve(__dirname, '../../schemas/auth.request.json'), 'utf8'));
                            metadata = {
                                encoding: x_hd_wallet_api_crypto_1.Encodings.MSGPACK,
                                schema: authSchema,
                            };
                            encoded = msgpack.encode(challenge);
                            return [4 /*yield*/, cryptoService.signData(rootKey, x_hd_wallet_api_crypto_1.KeyContexts.Address, 0, 0, encoded, metadata)];
                        case 1:
                            signature = _d.sent();
                            return [4 /*yield*/, (0, vitest_1.expect)(signature).toHaveLength(64)];
                        case 2:
                            _d.sent();
                            _b = (_a = cryptoService).verifyWithPublicKey;
                            _c = [signature,
                                encoded];
                            return [4 /*yield*/, cryptoService.keyGen(rootKey, x_hd_wallet_api_crypto_1.KeyContexts.Address, 0, 0)];
                        case 3: return [4 /*yield*/, _b.apply(_a, _c.concat([_d.sent()]))];
                        case 4:
                            isValid = _d.sent();
                            return [4 /*yield*/, (0, vitest_1.expect)(isValid).toBe(true)];
                        case 5:
                            _d.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            (0, vitest_1.test)('\(OK) Sign authentication challenge of 32 bytes, no encoding', function () { return __awaiter(void 0, void 0, void 0, function () {
                var challenge, authSchema, metadata, signature, isValid, _a, _b, _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            challenge = new Uint8Array((0, crypto_1.randomBytes)(32));
                            authSchema = JSON.parse((0, fs_1.readFileSync)(node_path_1.default.resolve(__dirname, '../../schemas/auth.request.json'), 'utf8'));
                            metadata = {
                                encoding: x_hd_wallet_api_crypto_1.Encodings.NONE,
                                schema: authSchema,
                            };
                            return [4 /*yield*/, cryptoService.signData(rootKey, x_hd_wallet_api_crypto_1.KeyContexts.Address, 0, 0, challenge, metadata)];
                        case 1:
                            signature = _d.sent();
                            return [4 /*yield*/, (0, vitest_1.expect)(signature).toHaveLength(64)];
                        case 2:
                            _d.sent();
                            _b = (_a = cryptoService).verifyWithPublicKey;
                            _c = [signature,
                                challenge];
                            return [4 /*yield*/, cryptoService.keyGen(rootKey, x_hd_wallet_api_crypto_1.KeyContexts.Address, 0, 0)];
                        case 3: return [4 /*yield*/, _b.apply(_a, _c.concat([_d.sent()]))];
                        case 4:
                            isValid = _d.sent();
                            return [4 /*yield*/, (0, vitest_1.expect)(isValid).toBe(true)];
                        case 5:
                            _d.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            (0, vitest_1.test)('\(OK) Sign Arbitrary Message against Schema, encoded base64', function () { return __awaiter(void 0, void 0, void 0, function () {
                var firstKey, message, to_base64, encoded, jsonSchema, metadata, signature, isValid;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, cryptoService.keyGen(rootKey, x_hd_wallet_api_crypto_1.KeyContexts.Address, 0, 0)];
                        case 1:
                            firstKey = _a.sent();
                            message = {
                                letter: 'Hello World',
                            };
                            return [4 /*yield*/, (0, sumo_1.default)()];
                        case 2:
                            to_base64 = (_a.sent()).to_base64;
                            encoded = Buffer.from(to_base64(JSON.stringify(message)));
                            jsonSchema = {
                                type: 'object',
                                properties: {
                                    letter: {
                                        type: 'string',
                                    },
                                },
                            };
                            metadata = {
                                encoding: x_hd_wallet_api_crypto_1.Encodings.BASE64,
                                schema: jsonSchema,
                            };
                            return [4 /*yield*/, cryptoService.signData(rootKey, x_hd_wallet_api_crypto_1.KeyContexts.Address, 0, 0, encoded, metadata)];
                        case 3:
                            signature = _a.sent();
                            return [4 /*yield*/, (0, vitest_1.expect)(signature).toHaveLength(64)];
                        case 4:
                            _a.sent();
                            return [4 /*yield*/, cryptoService.verifyWithPublicKey(signature, encoded, firstKey)];
                        case 5:
                            isValid = _a.sent();
                            return [4 /*yield*/, (0, vitest_1.expect)(isValid).toBe(true)];
                        case 6:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            (0, vitest_1.test)('\(OK) Sign Arbitrary Message against Schema, encoded msgpack', function () { return __awaiter(void 0, void 0, void 0, function () {
                var firstKey, message, encoded, jsonSchema, metadata, signature, isValid;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, cryptoService.keyGen(rootKey, x_hd_wallet_api_crypto_1.KeyContexts.Address, 0, 0)];
                        case 1:
                            firstKey = _a.sent();
                            message = {
                                letter: 'Hello World',
                            };
                            encoded = Buffer.from(msgpack.encode(message));
                            jsonSchema = {
                                type: 'object',
                                properties: {
                                    letter: {
                                        type: 'string',
                                    },
                                },
                            };
                            metadata = {
                                encoding: x_hd_wallet_api_crypto_1.Encodings.MSGPACK,
                                schema: jsonSchema,
                            };
                            return [4 /*yield*/, cryptoService.signData(rootKey, x_hd_wallet_api_crypto_1.KeyContexts.Address, 0, 0, encoded, metadata)];
                        case 2:
                            signature = _a.sent();
                            return [4 /*yield*/, (0, vitest_1.expect)(signature).toHaveLength(64)];
                        case 3:
                            _a.sent();
                            return [4 /*yield*/, cryptoService.verifyWithPublicKey(signature, encoded, firstKey)];
                        case 4:
                            isValid = _a.sent();
                            return [4 /*yield*/, (0, vitest_1.expect)(isValid).toBe(true)];
                        case 5:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            (0, vitest_1.test)('\(FAIL) Signing attempt fails because of invalid data against Schema, encoded base64', function () { return __awaiter(void 0, void 0, void 0, function () {
                var message, to_base64, encoded, jsonSchema, metadata;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            message = {
                                letter: 'Hello World',
                            };
                            return [4 /*yield*/, (0, sumo_1.default)()];
                        case 1:
                            to_base64 = (_a.sent()).to_base64;
                            encoded = Buffer.from(to_base64(JSON.stringify(message)));
                            jsonSchema = {
                                type: 'string',
                            };
                            metadata = {
                                encoding: x_hd_wallet_api_crypto_1.Encodings.BASE64,
                                schema: jsonSchema,
                            };
                            return [4 /*yield*/, (0, vitest_1.expect)(cryptoService.signData(rootKey, x_hd_wallet_api_crypto_1.KeyContexts.Identity, 0, 0, encoded, metadata)).rejects.toThrowError()];
                        case 2:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            (0, vitest_1.test)('\(FAIL) Signing attempt fails because of invalid data against Schema, encoded msgpack', function () { return __awaiter(void 0, void 0, void 0, function () {
                var message, encoded, jsonSchema, metadata;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            message = {
                                letter: 'Hello World',
                            };
                            encoded = Buffer.from(msgpack.encode(message));
                            jsonSchema = {
                                type: 'string',
                            };
                            metadata = {
                                encoding: x_hd_wallet_api_crypto_1.Encodings.MSGPACK,
                                schema: jsonSchema,
                            };
                            return [4 /*yield*/, (0, vitest_1.expect)(cryptoService.signData(rootKey, x_hd_wallet_api_crypto_1.KeyContexts.Identity, 0, 0, encoded, metadata)).rejects.toThrowError()];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            (0, vitest_1.describe)('Reject Regular Transaction Signing. IF TAG Prexies are present signing must fail', function () {
                (0, vitest_1.test)('\(FAIL) [TX] Tag', function () { return __awaiter(void 0, void 0, void 0, function () {
                    var transaction, metadata;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                transaction = Buffer.concat([
                                    Buffer.from('TX'),
                                    msgpack.encode((0, crypto_1.randomBytes)(64)),
                                ]);
                                metadata = {
                                    encoding: x_hd_wallet_api_crypto_1.Encodings.MSGPACK,
                                    schema: {},
                                };
                                return [4 /*yield*/, (0, vitest_1.expect)(cryptoService.signData(rootKey, x_hd_wallet_api_crypto_1.KeyContexts.Identity, 0, 0, transaction, metadata)).rejects.toThrowError(x_hd_wallet_api_crypto_1.ERROR_TAGS_FOUND)];
                            case 1:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
                (0, vitest_1.test)('\(FAIL) [MX] Tag', function () { return __awaiter(void 0, void 0, void 0, function () {
                    var transaction, metadata;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                transaction = Buffer.concat([
                                    Buffer.from('MX'),
                                    msgpack.encode((0, crypto_1.randomBytes)(64)),
                                ]);
                                metadata = {
                                    encoding: x_hd_wallet_api_crypto_1.Encodings.MSGPACK,
                                    schema: {},
                                };
                                return [4 /*yield*/, (0, vitest_1.expect)(cryptoService.signData(rootKey, x_hd_wallet_api_crypto_1.KeyContexts.Identity, 0, 0, transaction, metadata)).rejects.toThrowError(x_hd_wallet_api_crypto_1.ERROR_TAGS_FOUND)];
                            case 1:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
                (0, vitest_1.test)('\(FAIL) [Program] Tag', function () { return __awaiter(void 0, void 0, void 0, function () {
                    var transaction, metadata;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                transaction = Buffer.concat([
                                    Buffer.from('Program'),
                                    msgpack.encode((0, crypto_1.randomBytes)(64)),
                                ]);
                                metadata = {
                                    encoding: x_hd_wallet_api_crypto_1.Encodings.MSGPACK,
                                    schema: {},
                                };
                                return [4 /*yield*/, (0, vitest_1.expect)(cryptoService.signData(rootKey, x_hd_wallet_api_crypto_1.KeyContexts.Identity, 0, 0, transaction, metadata)).rejects.toThrowError(x_hd_wallet_api_crypto_1.ERROR_TAGS_FOUND)];
                            case 1:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
                (0, vitest_1.test)('\(FAIL) [progData] Tag', function () { return __awaiter(void 0, void 0, void 0, function () {
                    var transaction, metadata;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                transaction = Buffer.concat([
                                    Buffer.from('ProgData'),
                                    msgpack.encode((0, crypto_1.randomBytes)(64)),
                                ]);
                                metadata = {
                                    encoding: x_hd_wallet_api_crypto_1.Encodings.MSGPACK,
                                    schema: {},
                                };
                                return [4 /*yield*/, (0, vitest_1.expect)(cryptoService.signData(rootKey, x_hd_wallet_api_crypto_1.KeyContexts.Identity, 0, 0, transaction, metadata)).rejects.toThrowError(x_hd_wallet_api_crypto_1.ERROR_TAGS_FOUND)];
                            case 1:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
            });
        });
        (0, vitest_1.describe)('signing transactions', function () {
            (0, vitest_1.test)('\(OK) Sign Transaction', function () { return __awaiter(void 0, void 0, void 0, function () {
                var key, prefixEncodedTx, sig;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, cryptoService.keyGen(rootKey, x_hd_wallet_api_crypto_1.KeyContexts.Address, 0, 0, x_hd_wallet_api_crypto_1.BIP32DerivationTypes.Khovratovich)
                            // this transaction wes successfully submitted to the network https://testnet.explorer.perawallet.app/tx/UJG3NVCSCW5A63KPV35BPAABLXMXTTEM2CVUKNS4EML3H3EYGMCQ/
                        ];
                        case 1:
                            key = _a.sent();
                            prefixEncodedTx = new Uint8Array(Buffer.from('VFiJo2FtdM0D6KNmZWXNA+iiZnbOAkeSd6NnZW6sdGVzdG5ldC12MS4womdoxCBIY7UYpLPITsgQ8i1PEIHLD3HwWaesIN7GL39w5Qk6IqJsds4CR5Zfo3JjdsQgYv6DK3rRBUS+gzemcENeUGSuSmbne9eJCXZbRrV2pvOjc25kxCBi/oMretEFRL6DN6ZwQ15QZK5KZud714kJdltGtXam86R0eXBlo3BheQ==', 'base64'));
                            return [4 /*yield*/, cryptoService.signAlgoTransaction(rootKey, x_hd_wallet_api_crypto_1.KeyContexts.Address, 0, 0, prefixEncodedTx, x_hd_wallet_api_crypto_1.BIP32DerivationTypes.Khovratovich)];
                        case 2:
                            sig = _a.sent();
                            return [4 /*yield*/, (0, vitest_1.expect)(encodeAddress(Buffer.from(key))).toEqual('ML7IGK322ECUJPUDG6THAQ26KBSK4STG4555PCIJOZNUNNLWU3Z3ZFXITA')];
                        case 3:
                            _a.sent();
                            return [4 /*yield*/, (0, vitest_1.expect)(tweetnacl_1.default.sign.detached.verify(prefixEncodedTx, sig, key)).toBe(true)];
                        case 4:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        (0, vitest_1.describe)('ECDH cases', function () {
            // Making sure Alice & Bob Have different root keys
            var aliceRootKey;
            var bobRootKey;
            (0, vitest_1.beforeEach)(function () {
                aliceRootKey = (0, bip32_ed25519_impl_1.fromSeed)(bip39.mnemonicToSeedSync('exact remain north lesson program series excess lava material second riot error boss planet brick rotate scrap army riot banner adult fashion casino bamboo', ''));
                bobRootKey = (0, bip32_ed25519_impl_1.fromSeed)(bip39.mnemonicToSeedSync('identify length ranch make silver fog much puzzle borrow relax occur drum blue oval book pledge reunion coral grace lamp recall fever route carbon', ''));
            });
            (0, vitest_1.test)('\(OK) ECDH', function () { return __awaiter(void 0, void 0, void 0, function () {
                var aliceKey, bobKey, aliceSharedSecret, bobSharedSecret, aliceSharedSecret2, bobSharedSecret2;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, cryptoService.keyGen(aliceRootKey, x_hd_wallet_api_crypto_1.KeyContexts.Identity, 0, 0)];
                        case 1:
                            aliceKey = _a.sent();
                            return [4 /*yield*/, cryptoService.keyGen(bobRootKey, x_hd_wallet_api_crypto_1.KeyContexts.Identity, 0, 0)];
                        case 2:
                            bobKey = _a.sent();
                            return [4 /*yield*/, cryptoService.ECDH(aliceRootKey, x_hd_wallet_api_crypto_1.KeyContexts.Identity, 0, 0, bobKey, true)];
                        case 3:
                            aliceSharedSecret = _a.sent();
                            return [4 /*yield*/, cryptoService.ECDH(bobRootKey, x_hd_wallet_api_crypto_1.KeyContexts.Identity, 0, 0, aliceKey, false)];
                        case 4:
                            bobSharedSecret = _a.sent();
                            return [4 /*yield*/, (0, vitest_1.expect)(aliceSharedSecret).toEqual(bobSharedSecret)];
                        case 5:
                            _a.sent();
                            return [4 /*yield*/, cryptoService.ECDH(aliceRootKey, x_hd_wallet_api_crypto_1.KeyContexts.Identity, 0, 0, bobKey, false)];
                        case 6:
                            aliceSharedSecret2 = _a.sent();
                            return [4 /*yield*/, cryptoService.ECDH(bobRootKey, x_hd_wallet_api_crypto_1.KeyContexts.Identity, 0, 0, aliceKey, true)];
                        case 7:
                            bobSharedSecret2 = _a.sent();
                            return [4 /*yield*/, (0, vitest_1.expect)(aliceSharedSecret2).toEqual(bobSharedSecret2)];
                        case 8:
                            _a.sent();
                            return [4 /*yield*/, (0, vitest_1.expect)(aliceSharedSecret2).not.toEqual(aliceSharedSecret)];
                        case 9:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            (0, vitest_1.test)('\(OK) ECDH, Encrypt and Decrypt', function () { return __awaiter(void 0, void 0, void 0, function () {
                var aliceKey, bobKey, aliceSharedSecret, bobSharedSecret, message, nonce, _a, crypto_secretbox_easy, crypto_secretbox_open_easy, cipherText, plainText;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, cryptoService.keyGen(aliceRootKey, x_hd_wallet_api_crypto_1.KeyContexts.Identity, 0, 0)];
                        case 1:
                            aliceKey = _b.sent();
                            return [4 /*yield*/, cryptoService.keyGen(bobRootKey, x_hd_wallet_api_crypto_1.KeyContexts.Identity, 0, 0)];
                        case 2:
                            bobKey = _b.sent();
                            return [4 /*yield*/, cryptoService.ECDH(aliceRootKey, x_hd_wallet_api_crypto_1.KeyContexts.Identity, 0, 0, bobKey, true)];
                        case 3:
                            aliceSharedSecret = _b.sent();
                            return [4 /*yield*/, cryptoService.ECDH(bobRootKey, x_hd_wallet_api_crypto_1.KeyContexts.Identity, 0, 0, aliceKey, false)];
                        case 4:
                            bobSharedSecret = _b.sent();
                            return [4 /*yield*/, (0, vitest_1.expect)(aliceSharedSecret).toEqual(bobSharedSecret)];
                        case 5:
                            _b.sent();
                            message = new Uint8Array(Buffer.from('Hello, World!'));
                            nonce = new Uint8Array([
                                16, 197, 142, 8, 174, 91, 118, 244, 202, 136, 43, 200, 97,
                                242, 104, 99, 42, 154, 191, 32, 67, 30, 6, 123,
                            ]);
                            return [4 /*yield*/, (0, sumo_1.default)()
                                // encrypt
                            ];
                        case 6:
                            _a = _b.sent(), crypto_secretbox_easy = _a.crypto_secretbox_easy, crypto_secretbox_open_easy = _a.crypto_secretbox_open_easy;
                            cipherText = crypto_secretbox_easy(message, nonce, aliceSharedSecret);
                            // log cipherText uint8array
                            console.log('cipherText', cipherText);
                            return [4 /*yield*/, (0, vitest_1.expect)(cipherText).toEqual(new Uint8Array([
                                    20, 107, 126, 154, 152, 197, 252, 227, 148, 39, 245,
                                    136, 233, 10, 199, 20, 219, 3, 53, 2, 113, 6, 190, 21,
                                    193, 119, 43, 44, 230,
                                ]))
                                // decrypt
                            ];
                        case 7:
                            _b.sent();
                            plainText = crypto_secretbox_open_easy(cipherText, nonce, bobSharedSecret);
                            return [4 /*yield*/, (0, vitest_1.expect)(plainText).toEqual(message)];
                        case 8:
                            _b.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            (0, vitest_1.test)('Libsodium example ECDH', function () { return __awaiter(void 0, void 0, void 0, function () {
                var _a, crypto_sign_keypair, crypto_sign_ed25519_sk_to_curve25519, crypto_sign_ed25519_pk_to_curve25519, crypto_scalarmult, crypto_kx_client_session_keys, crypto_kx_server_session_keys, alice, alicePvtKey, alicePubKey, aliceXPvt, aliceXPub, bob, bobPvtKey, bobPubKey, bobXPvt, bobXPub, aliceSecret, bobSecret, aliceSharedSecret, bobSharedSecret;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, (0, sumo_1.default)()
                            // keypair
                        ];
                        case 1:
                            _a = _b.sent(), crypto_sign_keypair = _a.crypto_sign_keypair, crypto_sign_ed25519_sk_to_curve25519 = _a.crypto_sign_ed25519_sk_to_curve25519, crypto_sign_ed25519_pk_to_curve25519 = _a.crypto_sign_ed25519_pk_to_curve25519, crypto_scalarmult = _a.crypto_scalarmult, crypto_kx_client_session_keys = _a.crypto_kx_client_session_keys, crypto_kx_server_session_keys = _a.crypto_kx_server_session_keys;
                            alice = crypto_sign_keypair();
                            alicePvtKey = alice.privateKey;
                            alicePubKey = alice.publicKey;
                            aliceXPvt = crypto_sign_ed25519_sk_to_curve25519(alicePvtKey);
                            aliceXPub = crypto_sign_ed25519_pk_to_curve25519(alicePubKey);
                            bob = crypto_sign_keypair();
                            bobPvtKey = bob.privateKey;
                            bobPubKey = bob.publicKey;
                            bobXPvt = crypto_sign_ed25519_sk_to_curve25519(bobPvtKey);
                            bobXPub = crypto_sign_ed25519_pk_to_curve25519(bobPubKey);
                            aliceSecret = crypto_scalarmult(aliceXPvt, bobXPub);
                            bobSecret = crypto_scalarmult(bobXPvt, aliceXPub);
                            return [4 /*yield*/, (0, vitest_1.expect)(aliceSecret).toEqual(bobSecret)];
                        case 2:
                            _b.sent();
                            aliceSharedSecret = crypto_kx_client_session_keys(aliceXPub, aliceXPvt, bobXPub);
                            bobSharedSecret = crypto_kx_server_session_keys(bobXPub, bobXPvt, aliceXPub);
                            // bilateral encryption channels
                            return [4 /*yield*/, (0, vitest_1.expect)(aliceSharedSecret.sharedRx).toEqual(bobSharedSecret.sharedTx)];
                        case 3:
                            // bilateral encryption channels
                            _b.sent();
                            return [4 /*yield*/, (0, vitest_1.expect)(bobSharedSecret.sharedTx).toEqual(aliceSharedSecret.sharedRx)];
                        case 4:
                            _b.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
        });
    });
    (0, vitest_1.describe)('\(deriveNodePrivate)', function () {
        (0, vitest_1.test)('\(FAIL) Should fail if during derivation scalar >= 2^255', function () { return __awaiter(void 0, void 0, void 0, function () {
            var bip44Path, g, derivationNode, i;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        bip44Path = [(0, x_hd_wallet_api_crypto_1.harden)(44), (0, x_hd_wallet_api_crypto_1.harden)(283), (0, x_hd_wallet_api_crypto_1.harden)(0), 0, 0];
                        g = 9;
                        return [4 /*yield*/, (0, bip32_ed25519_impl_1.deriveChildNodePrivate)(rootKey, bip44Path[0], g)
                            // 283'
                        ];
                    case 1:
                        derivationNode = _a.sent();
                        return [4 /*yield*/, (0, bip32_ed25519_impl_1.deriveChildNodePrivate)(derivationNode, bip44Path[1], g)
                            // 0'
                        ];
                    case 2:
                        // 283'
                        derivationNode = _a.sent();
                        return [4 /*yield*/, (0, bip32_ed25519_impl_1.deriveChildNodePrivate)(derivationNode, bip44Path[2], g)
                            // 0
                        ];
                    case 3:
                        // 0'
                        derivationNode = _a.sent();
                        return [4 /*yield*/, (0, bip32_ed25519_impl_1.deriveChildNodePrivate)(derivationNode, bip44Path[3], g)
                            // 0
                        ];
                    case 4:
                        // 0
                        derivationNode = _a.sent();
                        return [4 /*yield*/, (0, bip32_ed25519_impl_1.deriveChildNodePrivate)(derivationNode, bip44Path[4], g)];
                    case 5:
                        // 0
                        derivationNode = _a.sent();
                        i = 0;
                        _a.label = 6;
                    case 6:
                        if (!(i < 19)) return [3 /*break*/, 9];
                        return [4 /*yield*/, (0, bip32_ed25519_impl_1.deriveChildNodePrivate)(derivationNode, 0, g)];
                    case 7:
                        derivationNode = _a.sent();
                        _a.label = 8;
                    case 8:
                        i++;
                        return [3 /*break*/, 6];
                    case 9: 
                    // for the seed in this test, we know where the scalar breaks (>= 2 ^ 255)
                    // expect error at the 20th level for this known seed
                    return [4 /*yield*/, (0, vitest_1.expect)((0, bip32_ed25519_impl_1.deriveChildNodePrivate)(derivationNode, 0, g)).rejects.toThrow('zL * 8 is larger than 2^255, which is not safe')];
                    case 10:
                        // for the seed in this test, we know where the scalar breaks (>= 2 ^ 255)
                        // expect error at the 20th level for this known seed
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('\(deriveNodePublic', function () {
        (0, vitest_1.test)("\(OK) From m'/44'/283'/0'/0 root level (excluding address index) derive N keys with only public information", function () { return __awaiter(void 0, void 0, void 0, function () {
            var walletRoot, numPublicKeysToDerive, i, derivedKey, _a, myKey;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, cryptoService.deriveKey(rootKey, [(0, x_hd_wallet_api_crypto_1.harden)(44), (0, x_hd_wallet_api_crypto_1.harden)(283), (0, x_hd_wallet_api_crypto_1.harden)(0), 0], false, x_hd_wallet_api_crypto_1.BIP32DerivationTypes.Peikert)
                        // should be able to derive all public keys from this root without knowing private information
                        // since these are SOFTLY derived
                    ];
                    case 1:
                        walletRoot = _b.sent();
                        numPublicKeysToDerive = 10;
                        i = 0;
                        _b.label = 2;
                    case 2:
                        if (!(i < numPublicKeysToDerive)) return [3 /*break*/, 7];
                        _a = Uint8Array.bind;
                        return [4 /*yield*/, (0, bip32_ed25519_impl_1.deriveChildNodePublic)(walletRoot, i, x_hd_wallet_api_crypto_1.BIP32DerivationTypes.Peikert)];
                    case 3:
                        derivedKey = new (_a.apply(Uint8Array, [void 0, _b.sent()]))() // g == 9
                        ;
                        return [4 /*yield*/, cryptoService.keyGen(rootKey, x_hd_wallet_api_crypto_1.KeyContexts.Address, 0, i, x_hd_wallet_api_crypto_1.BIP32DerivationTypes.Peikert)
                            // they should match
                            // derivedKey.subarray(0, 32) ==  public key (excluding chaincode)
                        ];
                    case 4:
                        myKey = _b.sent();
                        // they should match
                        // derivedKey.subarray(0, 32) ==  public key (excluding chaincode)
                        return [4 /*yield*/, (0, vitest_1.expect)(derivedKey.slice(0, 32)).toEqual(myKey)];
                    case 5:
                        // they should match
                        // derivedKey.subarray(0, 32) ==  public key (excluding chaincode)
                        _b.sent();
                        _b.label = 6;
                    case 6:
                        i++;
                        return [3 /*break*/, 2];
                    case 7: return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.test)("\(FAIL) From m'/44'/283'/0'/0' root level (excluding address index) should not be able to derive correct addresses from a hardened derivation", function () { return __awaiter(void 0, void 0, void 0, function () {
            var walletRoot, numPublicKeysToDerive, i, derivedKey, _a, myKey;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, cryptoService.deriveKey(rootKey, [(0, x_hd_wallet_api_crypto_1.harden)(44), (0, x_hd_wallet_api_crypto_1.harden)(283), (0, x_hd_wallet_api_crypto_1.harden)(0), (0, x_hd_wallet_api_crypto_1.harden)(0)], false, x_hd_wallet_api_crypto_1.BIP32DerivationTypes.Peikert)];
                    case 1:
                        walletRoot = _b.sent();
                        numPublicKeysToDerive = 10;
                        i = 0;
                        _b.label = 2;
                    case 2:
                        if (!(i < numPublicKeysToDerive)) return [3 /*break*/, 7];
                        _a = Uint8Array.bind;
                        return [4 /*yield*/, (0, bip32_ed25519_impl_1.deriveChildNodePublic)(walletRoot, i, x_hd_wallet_api_crypto_1.BIP32DerivationTypes.Peikert)];
                    case 3:
                        derivedKey = new (_a.apply(Uint8Array, [void 0, _b.sent()]))() // g == 9
                        ;
                        return [4 /*yield*/, cryptoService.keyGen(rootKey, x_hd_wallet_api_crypto_1.KeyContexts.Address, 0, i, x_hd_wallet_api_crypto_1.BIP32DerivationTypes.Peikert)
                            // they should NOT match  since the `change` level (as part of BIP44) was hardened
                            // derivedKey.subarray(0, 32) ==  public key (excluding chaincode)
                        ];
                    case 4:
                        myKey = _b.sent();
                        // they should NOT match  since the `change` level (as part of BIP44) was hardened
                        // derivedKey.subarray(0, 32) ==  public key (excluding chaincode)
                        return [4 /*yield*/, (0, vitest_1.expect)(derivedKey.slice(0, 32)).not.toEqual(myKey)];
                    case 5:
                        // they should NOT match  since the `change` level (as part of BIP44) was hardened
                        // derivedKey.subarray(0, 32) ==  public key (excluding chaincode)
                        _b.sent();
                        _b.label = 6;
                    case 6:
                        i++;
                        return [3 /*break*/, 2];
                    case 7: return [2 /*return*/];
                }
            });
        }); });
    });
});
