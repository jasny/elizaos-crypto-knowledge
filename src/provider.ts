import { elizaLogger, IAgentRuntime, Memory, Provider, ServiceType, State } from '@elizaos/core';
import { figureOutTokenSymbol, getTokensFromContext, TokenList } from './utils/context.ts';
import { About, Info, Price } from './types.ts';
import { CoinMarketCap } from './services/coinmarketcap.ts';

function formatCurrency(currency: string, amount: number | null): string {
    if (amount === null || amount === 0) return 'N/A';

    const digitsAfterZero = amount < 10 ? -1 * Math.floor(Math.log10(amount)) + 3 : 2;
    return currency + (currency.length > 1 ? ' ' : '') + amount.toFixed(digitsAfterZero);
}

function formatUpDown(amount: number | null): string {
    if (amount === null) return 'N/A';

    return `${(amount > 0 ? '+' : '') + amount.toFixed(2)}%`;
}

function formatDate(jsonDate: string | null): string {
    if (jsonDate === null) return 'N/A';

    const date = new Date(jsonDate);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

async function getGlobalMarketReport(runtime: IAgentRuntime): Promise<string> {
    try {
        const cmc = runtime.getService<CoinMarketCap>('coinmarketcap' as ServiceType);
        const [metrics, fearGreed, prices] = await Promise.all([
            cmc.globalMetrics(),
            cmc.fearAndGreed(),
            cmc.price(['BTC', 'ETH', 'SOL']),
        ]);
        const quote = metrics.quote.USD;

        const btc = prices.find((price) => price.symbol === 'BTC')?.quote?.USD;
        const eth = prices.find((price) => price.symbol === 'ETH')?.quote?.USD;
        const sol = prices.find((price) => price.symbol === 'SOL')?.quote?.USD;

        return [
            '## Global Market Metrics',
            `Market Cap: ${formatCurrency('$', quote.total_market_cap)} (${formatUpDown(quote.total_market_cap_yesterday_percentage_change)} 24h)`,
            `24h Volume: ${formatCurrency('$', quote.total_volume_24h)} (${formatUpDown(quote.total_volume_24h_yesterday_percentage_change)} 24h)`,
            btc
                ? `BTC Price: ${formatCurrency('$', btc.price)} (${formatUpDown(btc.percent_change_24h)} 24h | ${formatUpDown(btc.percent_change_7d)} 7d | ${formatUpDown(btc.percent_change_30d)} 30d) | BTC Dominance: ${metrics.btc_dominance.toFixed(2)}% (${formatUpDown(metrics.btc_dominance_24h_percentage_change)} 24h)`
                : 'BTC: N/A',
            eth
                ? `ETH Price: ${formatCurrency('$', eth.price)} (${formatUpDown(eth.percent_change_24h)} 24h | ${formatUpDown(eth.percent_change_7d)} 7d | ${formatUpDown(eth.percent_change_30d)} 30d) | ETH Dominance: ${metrics.eth_dominance.toFixed(2)}% (${formatUpDown(metrics.eth_dominance_24h_percentage_change)} 24h)`
                : 'ETH: N/A',
            sol
                ? `SOL Price: ${formatCurrency('$', sol.price)} (${formatUpDown(sol.percent_change_24h)} 24h | ${formatUpDown(sol.percent_change_7d)} 7d | ${formatUpDown(sol.percent_change_30d)} 30d)`
                : 'SOL: N/A',
            fearGreed
                ? `Fear & Greed: ${fearGreed.value} (${fearGreed.value_classification})`
                : 'Fear & Greed: N/A',
        ].join('\n');
    } catch (error) {
        elizaLogger.error(`Failed to get global market metrics: ${error}`);
        return 'I failed to get global market metrics';
    }
}

async function getTokenReports(
    runtime: IAgentRuntime,
    message: Memory,
    state?: State
): Promise<string[]> {
    const tokens = await getTokensFromContext(runtime, message, state)
        .then((tokens) =>
            Promise.all(
                tokens.map((token) =>
                    token.symbol ? token : figureOutTokenSymbol(runtime, token.name)
                )
            )
        )
        .catch((error) => {
            elizaLogger.error(`Failed to get tokens from context: ${error}`);
            return [];
        });

    if (tokens.length === 0) {
        return [];
    }

    const map = await fetchTokenInfo(runtime, tokens);

    return Array.from(
        map.values().map(({ info, price, about }) => {
            try {
                return generateReport(info, price, about);
            } catch (error) {
                elizaLogger.error(
                    `Failed to generate report for ${info.name} (${info.symbol}): ${error}`
                );
                return `I failed to generate a report for ${info.name}`;
            }
        })
    );
}

async function fetchTokenInfo(
    runtime: IAgentRuntime,
    tokens: TokenList
): Promise<Map<string, { info: Info | TokenList[number]; price?: Price; about?: About }>> {
    const symbols = tokens.filter((token) => !!token.symbol).map((token) => token.symbol);

    const cmc = runtime.getService<CoinMarketCap>('coinmarketcap' as ServiceType);

    const [infos, prices] = await Promise.all([cmc.info(symbols), cmc.price(symbols)]);
    const abouts = await cmc.about(infos);

    const map = new Map<string, { info: Info | TokenList[number]; price?: Price; about?: About }>(
        tokens.map((token) => [token.symbol, { info: token }])
    );
    for (const info of infos) {
        map.get(info.symbol).info = info;
    }
    for (const price of prices) {
        map.get(price.symbol).price = price;
    }
    for (const about of abouts) {
        map.get(about.symbol).about = about;
    }

    return map;
}

function generateReport(info: Info | TokenList[number], price?: Price, about?: About): string {
    const title = info.name ? info.name + (info.symbol ? ` (${info.symbol})` : '') : info.symbol;

    if (!('id' in info)) {
        elizaLogger.log(`Not enough info to generate token report for ${title}`);
        return `I don't have any information on ${title}`;
    }

    elizaLogger.log(`Generating token report for ${title}`);

    const lines = [`## About ${title}`];

    if (price) {
        const currency = Object.keys(price.quote)[0] === 'USD' ? '$' : Object.keys(price.quote)[0];
        const quote = Object.values(price.quote)[0];

        lines.push(
            `Rank: ${price.cmc_rank}`,
            `Price: ${formatCurrency(currency, quote.price)} (${formatUpDown(quote.percent_change_24h)} 24h | ${formatUpDown(quote.percent_change_7d)} 7d | ${formatUpDown(quote.percent_change_30d)} 30d)`,
            `Market Cap: ${formatCurrency(currency, quote.market_cap ?? (currency === '$' ? price.self_reported_market_cap : null))}`,
            `Volume: ${currency} ${quote.volume_24h.toFixed()} 24h | ${currency} ${quote.volume_7d.toFixed()} 7d | ${currency} ${quote.volume_30d.toFixed()} 30d`
        );
    }

    if (info.date_launched) lines.push(`Launched: ${formatDate(info.date_launched)}`, '');

    if (about) {
        lines.push(about.content, '');
    }

    if (info.urls.website.length > 0) lines.push(`* [Website](${info.urls.website[0]})`);
    if (info.urls.twitter.length > 0) lines.push(`* [Twitter](${info.urls.twitter[0]})`);
    if (info.urls.reddit.length > 0) lines.push(`* [Reddit](${info.urls.reddit[0]})`);
    const telegram = info.urls.chat.filter((url) => url.startsWith('https://t.me/'));
    if (telegram.length > 0) lines.push(`* [Telegram](${telegram[0]})`);

    return lines.join('\n').trim();
}

export const tokenKnowledgeProvider: Provider = {
    async get(runtime: IAgentRuntime, message: Memory, state?: State): Promise<string> {
        const reports = [
            await getGlobalMarketReport(runtime),
            ...(await getTokenReports(runtime, message, state)),
        ];
        return `\n${reports.join('\n\n')}`;
    },
};
