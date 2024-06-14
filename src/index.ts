import fs from 'fs/promises';
import path from 'path';
import { MongoClient, Db, Collection } from 'mongodb';

/**
 * Required Environment Variables:
 *
 * DB_USERNAME - The username for the MongoDB database.
 * DB_PASSWORD - The password for the MongoDB database.
 * DB_NAME - The name of the MongoDB database.
 * DB_CLUSTER - The cluster name for the MongoDB connection.
 *
 * Example:
 * DB_USERNAME=myUsername
 * DB_PASSWORD=myPassword
 * DB_NAME=myDatabase
 * DB_CLUSTER=myCluster.mongodb.net
 */

export interface EnvKeyResult {
	key: string;
	index: number;
	message: string;
}

export interface GetNextEnvKeyParams {
	baseEnvName: string;
	storage?: 'DISK' | 'MEMORY' | 'DATABASE';
}

export interface Cache {
	index: number;
}

// MongoDB configuration with fallbacks
const {
	DB_USERNAME: dbUsername = '',
	DB_PASSWORD: dbPassword = '',
	DB_NAME: dbName = 'defaultDbName',
	DB_CLUSTER: dbClusterName = 'defaultClusterName',
} = process.env;

const uri = `mongodb+srv://${encodeURIComponent(dbUsername)}:${encodeURIComponent(dbPassword)}@${dbClusterName}/?retryWrites=true&w=majority`;

let client: MongoClient | null = null;
let db: Db | null = null;

// Memory cache
const memoryCaches: Record<string, Cache> = {};

// Utility functions for MongoDB connection
const connectWithRetry = async (uri: string, attempts = 5): Promise<MongoClient> => {
	for (let attempt = 1; attempt <= attempts; attempt++) {
		try {
			const client = new MongoClient(uri);
			await client.connect();
			return client;
		} catch (error) {
			if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
			else throw error;
		}
	}
	throw new Error('Connection attempts exceeded.');
};

const connectToMongo = async (): Promise<Db> => {
	if (!client) {
		client = await connectWithRetry(uri);
		db = client.db(dbName);
	}
	return db as Db;
};

const getFileIndexCollection = async (): Promise<Collection> => {
	const db = await connectToMongo();
	return db.collection('fileIndex');
};

// Environment keys handling functions
const getEnvKeys = (baseEnvName: string): string[] => {
	return Object.keys(process.env)
		.filter(envKey => envKey.startsWith(baseEnvName))
		.map(envKey => process.env[envKey])
		.filter(Boolean) as string[];
};

const handleDiskStorage = async (envKeys: string[], cacheFilePath: string): Promise<EnvKeyResult> => {
	let cache: Cache = { index: 0 };
	let message: string;

	try {
		const cacheFile = await fs.readFile(cacheFilePath, 'utf-8');
		cache = JSON.parse(cacheFile);
	} catch {
		// File does not exist or is not readable, we'll create a new one
	}

	const key = envKeys[cache.index];
	if (envKeys.length > 1) {
		cache.index = (cache.index + 1) % envKeys.length;
		await fs.writeFile(cacheFilePath, JSON.stringify(cache, null, 2));
		message = `Successfully retrieved the key and updated the file cache. Current index: ${cache.index}`;
	} else {
		message = `Successfully retrieved the key. Only one key available, index remains 0.`;
	}

	return { key, index: cache.index, message };
};

const handleMemoryStorage = (envKeys: string[], baseEnvName: string): EnvKeyResult => {
	if (!memoryCaches[baseEnvName]) {
		memoryCaches[baseEnvName] = { index: 0 };
	}

	const key = envKeys[memoryCaches[baseEnvName].index];
	if (envKeys.length > 1) {
		memoryCaches[baseEnvName].index = (memoryCaches[baseEnvName].index + 1) % envKeys.length;
	}

	const message =
		envKeys.length > 1
			? `Successfully retrieved the key and updated the memory cache. Current index: ${memoryCaches[baseEnvName].index}`
			: `Successfully retrieved the key. Only one key available, index remains 0.`;

	return { key, index: memoryCaches[baseEnvName].index, message };
};

const handleDatabaseStorage = async (envKeys: string[], baseEnvName: string): Promise<EnvKeyResult> => {
	if (!dbUsername || !dbPassword || !dbName) {
		throw new Error('DB_USERNAME, DB_PASSWORD, and DB_NAME environment variables must be set for database storage.');
	}

	const collection = await getFileIndexCollection();
	const cacheDoc = await collection.findOne({ name: `envCache_${baseEnvName}` });

	let index = 0;
	if (!cacheDoc) {
		await collection.insertOne({ name: `envCache_${baseEnvName}`, index: 0 });
	} else {
		index = cacheDoc.index;
	}

	const key = envKeys[index];
	if (envKeys.length > 1) {
		index = (index + 1) % envKeys.length;
		await collection.updateOne({ name: `envCache_${baseEnvName}` }, { $set: { index } });
		const message = `Successfully retrieved the key and updated the database cache. Current index: ${index}`;
		return { key, index, message };
	} else {
		const message = `Successfully retrieved the key. Only one key available, index remains 0.`;
		return { key, index: 0, message };
	}
};

export const getNextEnvKey = async ({ baseEnvName, storage = 'DATABASE' }: GetNextEnvKeyParams): Promise<EnvKeyResult> => {
	try {
		const envKeys = getEnvKeys(baseEnvName);

		if (envKeys.length === 0) {
			throw new Error(`No environment variables found with base name ${baseEnvName}.`);
		}

		if (envKeys.length === 1) {
			return { key: envKeys[0], index: 0, message: `Only one key available, using key with index 0.` };
		}

		const cacheFilePath = path.join(__dirname, `env_cache_${baseEnvName}.json`);
		switch (storage) {
			case 'DATABASE':
				return await handleDatabaseStorage(envKeys, baseEnvName);
			case 'MEMORY':
				return handleMemoryStorage(envKeys, baseEnvName);
			case 'DISK':
			default:
				return await handleDiskStorage(envKeys, cacheFilePath);
		}
	} catch (error: any) {
		const message = `Error: ${error.message}`;
		return { key: '', index: 0, message };
	}
};
