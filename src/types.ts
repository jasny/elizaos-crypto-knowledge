export interface GlobalMetrics {
    btc_dominance: number;
    eth_dominance: number;
    btc_dominance_24h_percentage_change: number;
    eth_dominance_24h_percentage_change: number;
    active_cryptocurrencies: number;
    total_cryptocurrencies: number;
    active_market_pairs: number;
    active_exchanges: number;
    total_exchanges: number;
    total_crypto_dex_currencies: number;
    last_updated: string;
    quote: {
        [key: string]: {
            total_market_cap: number;
            total_market_cap_yesterday_percentage_change: number;
            total_volume_24h: number;
            total_volume_24h_yesterday_percentage_change: number;
            total_volume_24h_reported: number;
            altcoin_volume_24h: number;
            altcoin_volume_24h_reported: number;
            altcoin_market_cap: number;
            defi_volume_24h: number;
            defi_volume_24h_reported: number;
            defi_24h_percentage_change: number;
            defi_market_cap: number;
            stablecoin_volume_24h: number;
            stablecoin_volume_24h_reported: number;
            stablecoin_24h_percentage_change: number;
            stablecoin_market_cap: number;
            derivatives_volume_24h: number;
            derivatives_volume_24h_reported: number;
            derivatives_24h_percentage_change: number;
            last_updated: string;
        };
    };
}

export interface FearAndGreed {
    value: number;
    value_classification: string;
}

interface Platform {
    id: number;
    name: string;
    symbol: string;
    slug: string;
    token_address: string;
}

export interface BasicInfo {
    id: number;
    rank: number;
    name: string;
    symbol: string;
    slug: string;
}

export interface About {
    id: number;
    symbol: string;
    slug: string;
    content: string;
}

export interface Info {
    id: number;
    name: string;
    symbol: string;
    slug: string;
    category: string;
    logo: string;
    description: string;
    date_added: string; // ISO 8601 timestamp
    date_launched: string | null; // ISO 8601 timestamp
    notice: string;
    tags: { slug: string; name: string; category: string }[];
    platform: Platform | null;
    self_reported_circulating_supply: number | null;
    self_reported_market_cap: number | null;
    self_reported_tags: string[] | null;
    infinite_supply: boolean | null;
    urls: {
        website: string[];
        twitter: string[];
        message_board: string[];
        chat: string[];
        facebook: string[];
        explorer: string[];
        reddit: string[];
        technical_doc: string[];
        source_code: string[];
        announcement: string[];
    };
}

export interface Price {
    id: number;
    name: string;
    symbol: string;
    slug: string;
    is_active: 0 | 1; // 1 if active, 0 if not
    is_fiat: 0 | 1; // 1 if fiat, 0 otherwise
    cmc_rank: number;
    num_market_pairs: number;
    circulating_supply: number;
    total_supply: number;
    market_cap_by_total_supply?: number; // Only returned if requested in aux
    max_supply: number;
    date_added: string; // ISO 8601 date
    tags: string[];
    platform: Platform | null;
    last_updated: string; // ISO 8601 date
    self_reported_circulating_supply?: number; // Optional
    self_reported_market_cap?: number; // Optional
    quote: {
        [currency: string]: Quote; // Quotes mapped by currency
    };
}

interface Quote {
    price: number;
    volume_24h: number;
    volume_change_24h: number;
    volume_24h_reported?: number; // Optional
    volume_7d?: number; // Optional
    volume_7d_reported?: number; // Optional
    volume_30d?: number; // Optional
    volume_30d_reported?: number; // Optional
    market_cap: number;
    market_cap_dominance: number;
    fully_diluted_market_cap: number;
    percent_change_1h: number;
    percent_change_24h: number;
    percent_change_7d: number;
    percent_change_30d?: number; // Optional
    last_updated: string; // ISO 8601 date
}
