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
export declare const getNextEnvKey: ({ baseEnvName, storage }: GetNextEnvKeyParams) => Promise<EnvKeyResult>;
