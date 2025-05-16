# @elizaos/plugin-crypto-knowledge

A plugin for ElizaOS that provides rich, contextual knowledge about cryptocurrencies and tokens using data from the CoinMarketCap API.

Unlike [`@elizaos/plugin-coinmarketcap`](https://github.com/elizaos-plugins/plugin-coinmarketcap), which responds to direct queries with live data, this plugin enriches the agent's long-term memory. It enables more intelligent, context-aware conversations about tokens, prices, and market trends.

## Features

* Periodically loads and caches top tokens from CoinMarketCap
* Adds token metadata and descriptions to the memory system with embeddings
* Provides contextual market reports and token summaries
* Updates global metrics (market cap, volume, dominance) and the Fear & Greed index
* Enables Eliza agents to reason about tokens even without direct user prompts

## Installation

```bash
npm install @elizaos/plugin-crypto-knowledge
```

## Configuration

1. **Get a CoinMarketCap API key**
   Sign up at [pro.coinmarketcap.com](https://pro.coinmarketcap.com) and get your API key.

2. **Set environment variables**
   Create a `.env` file or set the variables in your environment:

   ```bash
   COINMARKETCAP_API_KEY=your_api_key
   COINMARKETCAP_API_URL=https://pro-api.coinmarketcap.com # (optional, typically not needed)
   ```

3. **Register the plugin**

   ```ts
   import { cryptoKnowledgePlugin } from "@elizaos/plugin-crypto-knowledge";

   export const plugins = [
     cryptoKnowledgePlugin,
     // ... other plugins
   ];
   ```

4. **Optional: Character settings**

   ```json
   {
     "settings": {
       "cmc_top": 5000
     }
   }
   ```

  * `cmc_top`: Number of top tokens to preload into memory (default: 200)

## How It Differs from `@elizaos/plugin-coinmarketcap`

| Feature                     | `plugin-crypto-knowledge`             | `plugin-coinmarketcap`                         |
| --------------------------- |---------------------------------------| ---------------------------------------------- |
| Data source                 | CoinMarketCap                         | CoinMarketCap                                  |
| Memory integration          | ✅ Yes (with embeddings)               | ❌ No                                           |
| Periodic background updates | ✅ Yes (cron)                          | ❌ No                                           |
| Usage                       | Contextual reasoning, market analysis | Direct Q\&A (e.g., "What's the price of ETH?") |
| Best suited for             | Knowledgeable agents                  | Reactive tools                                 |
