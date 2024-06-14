# EnvHolster

EnvHolster is a Node.js package that allows you to rotate through multiple environment variables seamlessly. The current index can be stored on disk, in a MongoDB database, or in memory, providing flexibility based on your application's needs.

## Features

-   Rotate through any number of environment variables.
-   Store the current index on disk, in MongoDB, or in memory.
-   Easily configure and retrieve environment variables for various storage options.
-   Gracefully handle single or multiple environment variables.

## Installation

To install EnvHolster, use npm:

```bash
npm install envholster
```

## Configuration

Ensure you have the necessary environment variables set up for MongoDB if you plan to use the database storage option:

```env
DB_USERNAME=myUsername
DB_PASSWORD=myPassword
DB_NAME=myDatabase
DB_CLUSTER=myCluster.mongodb.net
```

## Usage

### Initialize and Rotate Environment Variables

```typescript
import { getNextEnvKey } from 'envholster';

// Example usage with disk storage
const rotateEnvKeys = async () => {
	const { key, index, message } = await getNextEnvKey({
		baseEnvName: 'MY_SERVICE_API_KEY_',
		storage: 'DISK', // Options: 'DISK', 'MEMORY', 'DATABASE'
	});

	console.log(`Current Key: ${key}, Index: ${index}`);
	console.log(message);
};

rotateEnvKeys();
```

### Fetch Weather Data Example

Here's an example of how you can use `EnvHolster` to fetch weather data, rotating through your API keys:

```typescript
import axios from 'axios';
import { getNextEnvKey } from 'envholster';

const fetchWeatherData = async ({ location, storage = 'DATABASE' }: { location: string; storage?: 'DISK' | 'MEMORY' | 'DATABASE' }) => {
	const { key: weatherApiKey, message: envMessage } = await getNextEnvKey({
		baseEnvName: 'VISUAL_CROSSING_WEATHER_API_KEY_',
		storage,
	});
	console.log(envMessage); // Optional: Log the message for debugging

	const encodedLocation = encodeURIComponent(location);
	const weatherApiUrl = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${encodedLocation}?unitGroup=metric&include=days&key=${weatherApiKey}&contentType=json`;

	const weatherResponse = await axios.get(weatherApiUrl);
	return weatherResponse.data;
};

fetchWeatherData({ location: 'New York' })
	.then(data => console.log(data))
	.catch(err => console.error(err));
```

## API

### `getNextEnvKey(params: GetNextEnvKeyParams): Promise<EnvKeyResult>`

Fetches the next environment key based on the provided storage option.

#### Parameters

-   `baseEnvName` (string): The base name of your environment variables (e.g., 'MY*SERVICE_API_KEY*').
-   `storage` (optional, string): The storage option for the index. Can be 'DISK', 'MEMORY', or 'DATABASE'.

#### Returns

A promise that resolves to an `EnvKeyResult` object:

-   `key` (string): The current environment variable key.
-   `index` (number): The current index.
-   `message` (string): A message detailing the operation's result.

### Example

```typescript
const { key, index, message } = await getNextEnvKey({
	baseEnvName: 'MY_SERVICE_API_KEY_',
	storage: 'MEMORY',
});
console.log(`Current Key: ${key}, Index: ${index}`);
console.log(message);
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request on GitHub.

## License

This project is licensed under the MIT License.

```

```
