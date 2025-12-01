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
var libsodium_wrappers_sumo_1 = require("libsodium-wrappers-sumo");
var loadLibSodium = function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, libsodium_wrappers_sumo_1.default.ready];
            case 1:
                _a.sent();
                return [2 /*return*/, {
                        crypto_core_ed25519_add: libsodium_wrappers_sumo_1.default.crypto_core_ed25519_add,
                        crypto_core_ed25519_scalar_add: libsodium_wrappers_sumo_1.default.crypto_core_ed25519_scalar_add,
                        crypto_core_ed25519_scalar_mul: libsodium_wrappers_sumo_1.default.crypto_core_ed25519_scalar_mul,
                        crypto_core_ed25519_scalar_reduce: libsodium_wrappers_sumo_1.default.crypto_core_ed25519_scalar_reduce,
                        crypto_hash_sha512: libsodium_wrappers_sumo_1.default.crypto_hash_sha512,
                        crypto_scalarmult_ed25519_base_noclamp: libsodium_wrappers_sumo_1.default.crypto_scalarmult_ed25519_base_noclamp,
                        crypto_sign_verify_detached: libsodium_wrappers_sumo_1.default.crypto_sign_verify_detached,
                        crypto_sign_ed25519_pk_to_curve25519: libsodium_wrappers_sumo_1.default.crypto_sign_ed25519_pk_to_curve25519,
                        crypto_scalarmult: libsodium_wrappers_sumo_1.default.crypto_scalarmult,
                        crypto_generichash: libsodium_wrappers_sumo_1.default.crypto_generichash,
                        crypto_sign_keypair: libsodium_wrappers_sumo_1.default.crypto_sign_keypair,
                        crypto_sign_ed25519_sk_to_curve25519: libsodium_wrappers_sumo_1.default.crypto_sign_ed25519_sk_to_curve25519,
                        crypto_secretbox_open_easy: libsodium_wrappers_sumo_1.default.crypto_secretbox_open_easy,
                        crypto_secretbox_easy: libsodium_wrappers_sumo_1.default.crypto_secretbox_easy,
                        crypto_kx_client_session_keys: libsodium_wrappers_sumo_1.default.crypto_kx_client_session_keys,
                        crypto_kx_server_session_keys: libsodium_wrappers_sumo_1.default.crypto_kx_server_session_keys,
                        to_base64: libsodium_wrappers_sumo_1.default.to_base64,
                    }];
        }
    });
}); };
exports.default = loadLibSodium;
