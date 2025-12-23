"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.credentials = exports.nodes = void 0;
const CouchDb_node_1 = require("./nodes/CouchDb/CouchDb.node");
const CouchDbApi_credentials_1 = require("./credentials/CouchDbApi.credentials");
exports.nodes = [CouchDb_node_1.CouchDb];
exports.credentials = [CouchDbApi_credentials_1.CouchDbApi];
