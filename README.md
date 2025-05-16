# @elizaos/plugin-token-knowledge

A plugin for Eliza that provides contextual knowledge about cryptocurrencies and tokens using the CoinMarketCap API.

## Features

- ...

## Installation

```bash
npm install @elizaos/plugin-token-knowledge
```

## Configuration

1. Get your API key from [CoinMarketCap](https://pro.coinmarketcap.com)

2. Set up your environment variables:

```bash
COINMARKETCAP_API_KEY=your_api_key
COINMARKETCAP_API_URL=https://pro-api.coinmarketcap.com
```

3. Register the plugin in your Eliza configuration:

```typescript
import { tokenKnowledgePlugin } from "@elizaos/plugin-token-knowledge";

// In your Eliza configuration
plugins: [
  tokenKnowledgePlugin,
    // ... other plugins
];
```

4. Configure your character settings:

```json
{
  "settings": {
    "cmc_top": 5000
  },
  "plugins": ["token-knowledge"]
}

```

## Usage

