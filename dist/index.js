"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNextEnvKey = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const mongodb_1 = require("mongodb");
// MongoDB configuration with fallbacks
const { DB_USERNAME: dbUsername = '', DB_PASSWORD: dbPassword = '', DB_NAME: dbName = 'defaultDbName', DB_CLUSTER: dbClusterName = 'defaultClusterName', } = process.env;
const uri = `mongodb+srv://${encodeURIComponent(dbUsername)}:${encodeURIComponent(dbPassword)}@${dbClusterName}/?retryWrites=true&w=majority`;
let client = null;
let db = null;
// Memory cache
const memoryCaches = {};
// Utility functions for MongoDB connection
const connectWithRetry = (uri_1, ...args_1) => __awaiter(void 0, [uri_1, ...args_1], void 0, function* (uri, attempts = 5) {
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            const client = new mongodb_1.MongoClient(uri);
            yield client.connect();
            return client;
        }
        catch (error) {
            if (attempt < attempts)
                yield new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            else
                throw error;
        }
    }
    throw new Error('Connection attempts exceeded.');
});
const connectToMongo = () => __awaiter(void 0, void 0, void 0, function* () {
    if (!client) {
        client = yield connectWithRetry(uri);
        db = client.db(dbName);
    }
    return db;
});
const getFileIndexCollection = () => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield connectToMongo();
    return db.collection('fileIndex');
});
// Environment keys handling functions
const getEnvKeys = (baseEnvName) => {
    return Object.keys(process.env)
        .filter(envKey => envKey.startsWith(baseEnvName))
        .map(envKey => process.env[envKey])
        .filter(Boolean);
};
const handleDiskStorage = (envKeys, cacheFilePath) => __awaiter(void 0, void 0, void 0, function* () {
    let cache = { index: 0 };
    let message;
    try {
        const cacheFile = yield promises_1.default.readFile(cacheFilePath, 'utf-8');
        cache = JSON.parse(cacheFile);
    }
    catch (_a) {
        // File does not exist or is not readable, we'll create a new one
    }
    const key = envKeys[cache.index];
    if (envKeys.length > 1) {
        cache.index = (cache.index + 1) % envKeys.length;
        yield promises_1.default.writeFile(cacheFilePath, JSON.stringify(cache, null, 2));
        message = `Successfully retrieved the key and updated the file cache. Current index: ${cache.index}`;
    }
    else {
        message = `Successfully retrieved the key. Only one key available, index remains 0.`;
    }
    return { key, index: cache.index, message };
});
const handleMemoryStorage = (envKeys, baseEnvName) => {
    if (!memoryCaches[baseEnvName]) {
        memoryCaches[baseEnvName] = { index: 0 };
    }
    const key = envKeys[memoryCaches[baseEnvName].index];
    if (envKeys.length > 1) {
        memoryCaches[baseEnvName].index = (memoryCaches[baseEnvName].index + 1) % envKeys.length;
    }
    const message = envKeys.length > 1
        ? `Successfully retrieved the key and updated the memory cache. Current index: ${memoryCaches[baseEnvName].index}`
        : `Successfully retrieved the key. Only one key available, index remains 0.`;
    return { key, index: memoryCaches[baseEnvName].index, message };
};
const handleDatabaseStorage = (envKeys, baseEnvName) => __awaiter(void 0, void 0, void 0, function* () {
    if (!dbUsername || !dbPassword || !dbName) {
        throw new Error('DB_USERNAME, DB_PASSWORD, and DB_NAME environment variables must be set for database storage.');
    }
    const collection = yield getFileIndexCollection();
    const cacheDoc = yield collection.findOne({ name: `envCache_${baseEnvName}` });
    let index = 0;
    if (!cacheDoc) {
        yield collection.insertOne({ name: `envCache_${baseEnvName}`, index: 0 });
    }
    else {
        index = cacheDoc.index;
    }
    const key = envKeys[index];
    if (envKeys.length > 1) {
        index = (index + 1) % envKeys.length;
        yield collection.updateOne({ name: `envCache_${baseEnvName}` }, { $set: { index } });
        const message = `Successfully retrieved the key and updated the database cache. Current index: ${index}`;
        return { key, index, message };
    }
    else {
        const message = `Successfully retrieved the key. Only one key available, index remains 0.`;
        return { key, index: 0, message };
    }
});
const getNextEnvKey = (_b) => __awaiter(void 0, [_b], void 0, function* ({ baseEnvName, storage = 'DATABASE' }) {
    try {
        const envKeys = getEnvKeys(baseEnvName);
        if (envKeys.length === 0) {
            throw new Error(`No environment variables found with base name ${baseEnvName}.`);
        }
        if (envKeys.length === 1) {
            return { key: envKeys[0], index: 0, message: `Only one key available, using key with index 0.` };
        }
        const cacheFilePath = path_1.default.join(__dirname, `env_cache_${baseEnvName}.json`);
        switch (storage) {
            case 'DATABASE':
                return yield handleDatabaseStorage(envKeys, baseEnvName);
            case 'MEMORY':
                return handleMemoryStorage(envKeys, baseEnvName);
            case 'DISK':
            default:
                return yield handleDiskStorage(envKeys, cacheFilePath);
        }
    }
    catch (error) {
        const message = `Error: ${error.message}`;
        return { key: '', index: 0, message };
    }
});
exports.getNextEnvKey = getNextEnvKey;
//# sourceMappingURL=index.js.map