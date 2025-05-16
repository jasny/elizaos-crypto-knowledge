import {
    elizaLogger,
    embed,
    IAgentRuntime,
    ICacheManager,
    IMemoryManager,
    knowledge,
    MemoryManager,
    Service,
    ServiceType,
    stringToUuid,
    UUID,
} from '@elizaos/core';
import pLimit from 'p-limit';
import { CoinMarketCap } from './coinmarketcap.ts';

export class GlobalTokenKnowledge extends Service {
    static serviceType = 'global-token-knowledge' as ServiceType;

    private cmc: CoinMarketCap;
    private memory: IMemoryManager;
    private cache: ICacheManager;
    private top = 100;

    async initialize(runtime: IAgentRuntime): Promise<void> {
        if (this.memory) return; // Why is `initialize` called twice?

        this.memory = new MemoryManager({
            runtime,
            tableName: 'cmc_tokens',
        });
        runtime.registerMemoryManager(this.memory);

        this.cmc = runtime.getService('coinmarketcap' as ServiceType) as CoinMarketCap;
        if (!this.cmc.isReady) await this.cmc.initialize(runtime);

        this.cache = runtime.cacheManager;

        this.top = Number(process.env.DEBUG_CMC_TOP || runtime.getSetting('cmc_top') || 100);
        const known = await this.memory.getMemoryById(stringToUuid(`cmc-top-${this.top}`));

        if (known && Date.now() - known.createdAt < 12 * 60 * 60 * 1000 /* 24 hours */) {
            elizaLogger.info(`CoinMarketCap top ${this.top} already known`);
        } else {
            try {
                await this.update(runtime);
            } catch (error) {
                elizaLogger.error(`Failed to update CoinMarketCap top ${this.top}: ${error}`);
            }
        }

        setInterval(
            () =>
                this.update(runtime).catch((error) =>
                    elizaLogger.error(`Failed to update CoinMarketCap top ${this.top}: ${error}`)
                ),
            12 * 60 * 60 * 1000 /* 12 hour */
        );

        await this.preloadGlobalMetrics();
    }

    async update(runtime: IAgentRuntime): Promise<void> {
        const limit = pLimit(10);
        const now = new Date();

        const tokens = await this.cmc.list(this.top);

        const info: string[] = [`Fetched top ${tokens.length} tokens from CoinMarketCap...`];
        if (tokens.length > 500) info.push('Hang tight, this might take a while');
        elizaLogger.info(info.join('\n'));

        // TODO, speed this up by using a batch insert

        const promises = this.uniqueSymbols(tokens).flatMap((token) => [
            limit(() => this.cache.set(`token-by-name:${token.name.toLowerCase()}`, token)),
            limit(() => this.cache.set(`token-by-symbol:${token.symbol.toLowerCase()}`, token)),
            limit(() =>
                this.addMemory(
                    runtime,
                    stringToUuid(token.id),
                    `${token.name} with symbol ${token.symbol} has rank ${token.rank} on CoinMarketCap`,
                    now
                )
            ),
        ]);
        await Promise.all(promises);

        await this.addMemory(
            runtime,
            stringToUuid(`cmc-top-${this.top}`),
            `Fetched top ${this.top} tokens from CoinMarketCap on ${now.toUTCString()}`,
            now
        );

        elizaLogger.success(`CoinMarketCap top ${this.top} updated`);
    }

    private async addMemory(
        runtime: IAgentRuntime,
        id: UUID,
        text: string,
        now: Date
    ): Promise<void> {
        const embedding = await embed(runtime, knowledge.preprocess(text));

        await this.memory.removeMemory(id);

        await this.memory.createMemory(
            {
                id,
                roomId: runtime.agentId,
                agentId: runtime.agentId,
                userId: runtime.agentId,
                createdAt: now.getTime(),
                content: { text },
                embedding,
            },
            true
        );
    }

    private uniqueSymbols<T extends { symbol: string }>(tokens: T[]): T[] {
        const map = new Map<string, T>();

        for (const token of tokens) {
            if (!map.has(token.symbol)) {
                map.set(token.symbol, token);
            }
        }

        return Array.from(map.values());
    }

    private async preloadGlobalMetrics(): Promise<void> {
        elizaLogger.info('Preloading global metrics...');

        await Promise.all([
            this.cmc
                .globalMetrics({ refresh: true })
                .catch((error) => elizaLogger.error(`Failed to preload global metrics: ${error}`)),
            this.cmc
                .fearAndGreed({ refresh: true })
                .catch((error) =>
                    elizaLogger.error(`Failed to preload fear and greed index: ${error}`)
                ),
            this.cmc
                .price(['BTC', 'ETH', 'SOL'])
                .catch((error) => elizaLogger.error(`Failed to preload prices: ${error}`)),
        ]);

        setInterval(
            () => {
                this.cmc
                    .globalMetrics({ refresh: true })
                    .catch((error) =>
                        elizaLogger.error(`Failed to preload global metrics: ${error}`)
                    )
                    .then();
                this.cmc
                    .fearAndGreed({ refresh: true })
                    .catch((error) =>
                        elizaLogger.error(`Failed to preload fear and greed index: ${error}`)
                    )
                    .then();
            },
            15 * 60 * 1000 /* 15 minutes */
        );
    }
}
