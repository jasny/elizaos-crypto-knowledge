import { Plugin } from '@elizaos/core';
import { CoinMarketCap } from './services/coinmarketcap.ts';
import { tokenKnowledgeProvider } from './provider.ts';
import { GlobalTokenKnowledge } from './services/global-token-knowledge.ts';

const cmcService = new CoinMarketCap();
const globalTokenKnowledgeService = new GlobalTokenKnowledge();

export const cryptoKnowledgePlugin: Plugin = {
    name: 'token-knowledge',
    description:
        'Provides contextual knowledge about cryptocurrencies and tokens using the CoinMarketCap API',
    services: [cmcService, globalTokenKnowledgeService],
    providers: [tokenKnowledgeProvider],
};
