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
exports.XHDWalletAPI = exports.ERROR_TAGS_FOUND = exports.ERROR_BAD_DATA = exports.harden = exports.Encodings = exports.BIP32DerivationTypes = exports.KeyContexts = void 0;
var sumo_1 = require("./sumo");
var msgpack = require("algo-msgpack-with-bigint");
var ajv_1 = require("ajv");
var bip32_ed25519_impl_1 = require("./bip32-ed25519-impl");
exports.KeyContexts = {
    Address: 0,
    Identity: 1,
};
exports.BIP32DerivationTypes = {
    // standard Ed25519 bip32 derivations based of: https://acrobat.adobe.com/id/urn:aaid:sc:EU:04fe29b0-ea1a-478b-a886-9bb558a5242a
    // Defines 32 bits to be zeroed from each derived zL
    Khovratovich: 32,
    // Derivations based on Peikert's ammendments to the original BIP32-Ed25519
    // Picking only 9 bits to be zeroed from each derived zL
    Peikert: 9,
};
exports.Encodings = {
    MSGPACK: 'msgpack',
    BASE64: 'base64',
    NONE: 'none',
};
var harden = function (num) { return 2147483648 + num; };
exports.harden = harden;
function GetBIP44PathFromContext(context, account, key_index) {
    switch (context) {
        case exports.KeyContexts.Address:
            return [(0, exports.harden)(44), (0, exports.harden)(283), (0, exports.harden)(account), 0, key_index];
        case exports.KeyContexts.Identity:
            return [(0, exports.harden)(44), (0, exports.harden)(0), (0, exports.harden)(account), 0, key_index];
        default:
            throw new Error('Invalid context');
    }
}
exports.ERROR_BAD_DATA = new Error('Invalid Data');
exports.ERROR_TAGS_FOUND = new Error('Transactions tags found');
var XHDWalletAPI = /** @class */ (function () {
    function XHDWalletAPI() {
    }
    /**
     * Derives a child key from the root key based on BIP44 path
     *
     * @param rootKey - root key in extended format (kL, kR, c). It should be 96 bytes long
     * @param bip44Path - BIP44 path (m / purpose' / coin_type' / account' / change / address_index). The ' indicates that the value is hardened
     * @param isPrivate  - if true, return the private key, otherwise return the public key
     * @returns - The extended private key (kL, kR, chainCode) or the extended public key (pub, chainCode)
     */
    XHDWalletAPI.prototype.deriveKey = function (rootKey_1, bip44Path_1) {
        return __awaiter(this, arguments, void 0, function (rootKey, bip44Path, isPrivate, derivationType) {
            var g, i, crypto_scalarmult_ed25519_base_noclamp;
            if (isPrivate === void 0) { isPrivate = true; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        g = derivationType === exports.BIP32DerivationTypes.Peikert ? 9 : 32;
                        i = 0;
                        _a.label = 1;
                    case 1:
                        if (!(i < bip44Path.length)) return [3 /*break*/, 4];
                        return [4 /*yield*/, (0, bip32_ed25519_impl_1.deriveChildNodePrivate)(rootKey, bip44Path[i], g)];
                    case 2:
                        rootKey = _a.sent();
                        _a.label = 3;
                    case 3:
                        i++;
                        return [3 /*break*/, 1];
                    case 4:
                        if (isPrivate)
                            return [2 /*return*/, rootKey];
                        return [4 /*yield*/, (0, sumo_1.default)()
                            // extended public key
                            // [public] [nodeCC]
                        ];
                    case 5:
                        crypto_scalarmult_ed25519_base_noclamp = (_a.sent()).crypto_scalarmult_ed25519_base_noclamp;
                        // extended public key
                        // [public] [nodeCC]
                        return [2 /*return*/, new Uint8Array(Buffer.concat([
                                crypto_scalarmult_ed25519_base_noclamp(rootKey.subarray(0, 32)),
                                rootKey.subarray(64, 96),
                            ]))];
                }
            });
        });
    };
    /**
     *
     *
     * @param context - context of the key (i.e Address, Identity)
     * @param account - account number. This value will be hardened as part of BIP44
     * @param keyIndex - key index. This value will be a SOFT derivation as part of BIP44.
     * @returns - public key 32 bytes
     */
    XHDWalletAPI.prototype.keyGen = function (rootKey_1, context_1, account_1, keyIndex_1) {
        return __awaiter(this, arguments, void 0, function (rootKey, context, account, keyIndex, derivationType) {
            var bip44Path, extendedKey;
            if (derivationType === void 0) { derivationType = exports.BIP32DerivationTypes.Peikert; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        bip44Path = GetBIP44PathFromContext(context, account, keyIndex);
                        return [4 /*yield*/, this.deriveKey(rootKey, bip44Path, false, derivationType)];
                    case 1:
                        extendedKey = _a.sent();
                        return [2 /*return*/, extendedKey.subarray(0, 32)]; // only public key
                }
            });
        });
    };
    /**
     * Raw Signing function called by signData and signTransaction
     *
     * Ref: https://datatracker.ietf.org/doc/html/rfc8032#section-5.1.6
     *
     * Edwards-Curve Digital Signature Algorithm (EdDSA)
     *
     * @param bip44Path
     * - BIP44 path (m / purpose' / coin_type' / account' / change / address_index)
     * @param data
     * - data to be signed in raw bytes
     *
     * @returns
     * - signature holding R and S, totally 64 bytes
     */
    XHDWalletAPI.prototype.rawSign = function (rootKey, bip44Path, data, derivationType) {
        return __awaiter(this, void 0, void 0, function () {
            var raw, scalar, kR, _a, crypto_scalarmult_ed25519_base_noclamp, crypto_core_ed25519_scalar_reduce, crypto_hash_sha512, crypto_core_ed25519_scalar_add, crypto_core_ed25519_scalar_mul, publicKey, r, R, h, S;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.deriveKey(rootKey, bip44Path, true, derivationType)];
                    case 1:
                        raw = _b.sent();
                        scalar = raw.slice(0, 32);
                        kR = raw.slice(32, 64);
                        return [4 /*yield*/, (0, sumo_1.default)()
                            // \(1): pubKey = scalar * G (base point, no clamp)
                        ];
                    case 2:
                        _a = _b.sent(), crypto_scalarmult_ed25519_base_noclamp = _a.crypto_scalarmult_ed25519_base_noclamp, crypto_core_ed25519_scalar_reduce = _a.crypto_core_ed25519_scalar_reduce, crypto_hash_sha512 = _a.crypto_hash_sha512, crypto_core_ed25519_scalar_add = _a.crypto_core_ed25519_scalar_add, crypto_core_ed25519_scalar_mul = _a.crypto_core_ed25519_scalar_mul;
                        publicKey = crypto_scalarmult_ed25519_base_noclamp(scalar);
                        r = crypto_core_ed25519_scalar_reduce(crypto_hash_sha512(Buffer.concat([kR, data])));
                        R = crypto_scalarmult_ed25519_base_noclamp(r);
                        h = crypto_core_ed25519_scalar_reduce(crypto_hash_sha512(Buffer.concat([R, publicKey, data])));
                        S = crypto_core_ed25519_scalar_add(r, crypto_core_ed25519_scalar_mul(h, scalar));
                        return [2 /*return*/, Buffer.concat([R, S])];
                }
            });
        });
    };
    /**
     * Ref: https://datatracker.ietf.org/doc/html/rfc8032#section-5.1.6
     *
     *  Edwards-Curve Digital Signature Algorithm (EdDSA)
     *
     * @param context - context of the key (i.e Address, Identity)
     * @param account - account number. This value will be hardened as part of BIP44
     * @param keyIndex - key index. This value will be a SOFT derivation as part of BIP44.
     * @param data - data to be signed in raw bytes
     * @param metadata - metadata object that describes how `data` was encoded and what schema to use to validate against
     * @param derivationType
     * - BIP32 derivation type, defines if it's standard Ed25519 or Peikert's ammendment to BIP32-Ed25519
     *
     * @returns - signature holding R and S, totally 64 bytes
     * */
    XHDWalletAPI.prototype.signData = function (rootKey_1, context_1, account_1, keyIndex_1, data_1, metadata_1) {
        return __awaiter(this, arguments, void 0, function (rootKey, context, account, keyIndex, data, metadata, derivationType) {
            var result, bip44Path;
            if (derivationType === void 0) { derivationType = exports.BIP32DerivationTypes.Peikert; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        result = this.validateData(data, metadata);
                        if (result instanceof Error) {
                            // decoding errors
                            throw result;
                        }
                        if (!result) {
                            // failed schema validation
                            throw exports.ERROR_BAD_DATA;
                        }
                        bip44Path = GetBIP44PathFromContext(context, account, keyIndex);
                        return [4 /*yield*/, this.rawSign(rootKey, bip44Path, data, derivationType)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Sign Algorand transaction
     * @param context
     * - context of the key (i.e Address, Identity)
     * @param account
     * - account number. This value will be hardened as part of BIP44
     * @param keyIndex
     * - key index. This value will be a SOFT derivation as part of BIP44.
     * @param prefixEncodedTx
     * - Encoded transaction object
     * @param derivationType
     * - BIP32 derivation type, defines if it's standard Ed25519 or Peikert's ammendment to BIP32-Ed25519
     *
     * @returns sig
     * - Raw bytes signature
     */
    XHDWalletAPI.prototype.signAlgoTransaction = function (rootKey_1, context_1, account_1, keyIndex_1, prefixEncodedTx_1) {
        return __awaiter(this, arguments, void 0, function (rootKey, context, account, keyIndex, prefixEncodedTx, derivationType) {
            var bip44Path, sig;
            if (derivationType === void 0) { derivationType = exports.BIP32DerivationTypes.Peikert; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        bip44Path = GetBIP44PathFromContext(context, account, keyIndex);
                        return [4 /*yield*/, this.rawSign(rootKey, bip44Path, prefixEncodedTx, derivationType)];
                    case 1:
                        sig = _a.sent();
                        return [2 /*return*/, sig];
                }
            });
        });
    };
    /**
     * SAMPLE IMPLEMENTATION to show how to validate data with encoding and schema, using base64 as an example
     *
     * @param message
     * @param metadata
     * @returns
     */
    XHDWalletAPI.prototype.validateData = function (message, metadata) {
        // Check that decoded doesn't include the following prefixes: TX, MX, progData, Program
        // These prefixes are reserved for the protocol
        if (this.hasAlgorandTags(message)) {
            return exports.ERROR_TAGS_FOUND;
        }
        var decoded;
        switch (metadata.encoding) {
            case exports.Encodings.BASE64:
                decoded = new Uint8Array(Buffer.from(Buffer.from(message).toString(), 'base64'));
                break;
            case exports.Encodings.MSGPACK:
                decoded = msgpack.decode(message);
                break;
            case exports.Encodings.NONE:
                decoded = message;
                break;
            default:
                throw new Error('Invalid encoding');
        }
        // validate with schema
        var ajv = new ajv_1.default();
        var validate = ajv.compile(metadata.schema);
        var valid = validate(decoded);
        if (!valid)
            console.log(ajv.errors);
        return valid;
    };
    /**
     * Detect if the message has Algorand protocol specific tags
     *
     * @param message - raw bytes of the message
     * @returns - true if message has Algorand protocol specific tags, false otherwise
     */
    XHDWalletAPI.prototype.hasAlgorandTags = function (message) {
        // Check that decoded doesn't include the following prefixes
        // Prefixes taken from go-algorand node software code
        // https://github.com/algorand/go-algorand/blob/master/protocol/hash.go
        var prefixes = [
            'appID',
            'arc',
            'aB',
            'aD',
            'aO',
            'aP',
            'aS',
            'AS',
            'B256',
            'BH',
            'BR',
            'CR',
            'GE',
            'KP',
            'MA',
            'MB',
            'MX',
            'NIC',
            'NIR',
            'NIV',
            'NPR',
            'OT1',
            'OT2',
            'PF',
            'PL',
            'Program',
            'ProgData',
            'PS',
            'PK',
            'SD',
            'SpecialAddr',
            'STIB',
            'spc',
            'spm',
            'spp',
            'sps',
            'spv',
            'TE',
            'TG',
            'TL',
            'TX',
            'VO',
        ];
        for (var _i = 0, prefixes_1 = prefixes; _i < prefixes_1.length; _i++) {
            var prefix = prefixes_1[_i];
            if (Buffer.from(message.subarray(0, prefix.length)).toString('ascii') === prefix) {
                return true;
            }
        }
        return false;
    };
    /**
     * Wrapper around libsodium basica signature verification
     *
     * Any lib or system that can verify EdDSA signatures can be used
     *
     * @param signature - raw 64 bytes signature (R, S)
     * @param message - raw bytes of the message
     * @param publicKey - raw 32 bytes public key (x,y)
     * @returns true if signature is valid, false otherwise
     */
    XHDWalletAPI.prototype.verifyWithPublicKey = function (signature, message, publicKey) {
        return __awaiter(this, void 0, void 0, function () {
            var crypto_sign_verify_detached;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, sumo_1.default)()];
                    case 1:
                        crypto_sign_verify_detached = (_a.sent()).crypto_sign_verify_detached;
                        return [2 /*return*/, crypto_sign_verify_detached(signature, message, publicKey)];
                }
            });
        });
    };
    /**
     * Function to perform ECDH against a provided public key
     *
     * ECDH reference link: https://en.wikipedia.org/wiki/Elliptic-curve_Diffie%E2%80%93Hellman
     *
     * It creates a shared secret between two parties. Each party only needs to be aware of the other's public key.
     * This symmetric secret can be used to derive a symmetric key for encryption and decryption. Creating a private channel between the two parties.
     *
     * @param context - context of the key (i.e Address, Identity)
     * @param account - account number. This value will be hardened as part of BIP44
     * @param keyIndex - key index. This value will be a SOFT derivation as part of BIP44.
     * @param otherPartyPub - raw 32 bytes public key of the other party
     * @param meFirst - defines the order in which the keys will be considered for the shared secret. If true, our key will be used first, otherwise the other party's key will be used first
     * @returns - raw 32 bytes shared secret
     */
    XHDWalletAPI.prototype.ECDH = function (rootKey_1, context_1, account_1, keyIndex_1, otherPartyPub_1, meFirst_1) {
        return __awaiter(this, arguments, void 0, function (rootKey, context, account, keyIndex, otherPartyPub, meFirst, derivationType) {
            var bip44Path, childKey, scalar, _a, crypto_scalarmult_ed25519_base_noclamp, crypto_sign_ed25519_pk_to_curve25519, crypto_scalarmult, ourPub, ourPubCurve25519, otherPartyPubCurve25519, sharedPoint, concatenation, crypto_generichash;
            if (derivationType === void 0) { derivationType = exports.BIP32DerivationTypes.Peikert; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        bip44Path = GetBIP44PathFromContext(context, account, keyIndex);
                        return [4 /*yield*/, this.deriveKey(rootKey, bip44Path, true, derivationType)];
                    case 1:
                        childKey = _b.sent();
                        scalar = childKey.slice(0, 32);
                        return [4 /*yield*/, (0, sumo_1.default)()
                            // our public key is derived from the private key
                        ];
                    case 2:
                        _a = _b.sent(), crypto_scalarmult_ed25519_base_noclamp = _a.crypto_scalarmult_ed25519_base_noclamp, crypto_sign_ed25519_pk_to_curve25519 = _a.crypto_sign_ed25519_pk_to_curve25519, crypto_scalarmult = _a.crypto_scalarmult;
                        ourPub = crypto_scalarmult_ed25519_base_noclamp(scalar);
                        ourPubCurve25519 = crypto_sign_ed25519_pk_to_curve25519(ourPub);
                        otherPartyPubCurve25519 = crypto_sign_ed25519_pk_to_curve25519(otherPartyPub);
                        sharedPoint = crypto_scalarmult(scalar, otherPartyPubCurve25519);
                        if (meFirst) {
                            concatenation = Buffer.concat([
                                sharedPoint,
                                ourPubCurve25519,
                                otherPartyPubCurve25519,
                            ]);
                        }
                        else {
                            concatenation = Buffer.concat([
                                sharedPoint,
                                otherPartyPubCurve25519,
                                ourPubCurve25519,
                            ]);
                        }
                        return [4 /*yield*/, (0, sumo_1.default)()];
                    case 3:
                        crypto_generichash = (_b.sent()).crypto_generichash;
                        return [2 /*return*/, crypto_generichash(32, new Uint8Array(concatenation))];
                }
            });
        });
    };
    return XHDWalletAPI;
}());
exports.XHDWalletAPI = XHDWalletAPI;
