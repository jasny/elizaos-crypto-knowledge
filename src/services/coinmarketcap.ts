import {
  CacheOptions,
  generateText,
  IAgentRuntime,
  ICacheManager,
  ModelClass,
  Service,
  ServiceType
} from '@elizaos/core';
import * as cheerio from 'cheerio';
import Turndown from 'turndown';
import { About, BasicInfo, FearAndGreed, GlobalMetrics, Info, Price } from "../types.ts"

type Fetch = typeof fetch;

export class CoinMarketCap extends Service {
  static serviceType = 'coinmarketcap' as ServiceType;

  private runtime: IAgentRuntime;
  private fetch: Fetch;
  private apiKey?: string;
  private baseUrl: string;
  private cache: ICacheManager;
  private turndown = new Turndown();

  get isReady(): boolean {
    return !!this.apiKey;
  }

  async initialize(runtime: IAgentRuntime): Promise<void> {
    this.runtime = runtime;
    this.fetch = runtime.fetch || fetch;
    this.apiKey = runtime.getSetting('COINMARKETCAP_API_KEY') || process.env.COINMARKETCAP_API_KEY;
    this.baseUrl = runtime.getSetting('COINMARKETCAP_API_URL')
      || process.env.COINMARKETCAP_API_URL
      || 'https://pro-api.coinmarketcap.com';
    this.cache = runtime.cacheManager;
  }

  private async get<T>(path: string, params: Record<string, string | number | boolean | undefined>): Promise<T> {
    const url = new URL(path, this.baseUrl);

    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined) return;
      url.searchParams.append(key, String(value));
    });

    const headers = {
      'X-CMC_PRO_API_KEY': this.apiKey,
    };

    const response = await this.fetch(url, { headers });

    const { data, status } = await response.json();

    if (Number(status.error_code) !== 0) {
      throw new Error(`Failed to fetch data from ${url}: ${status.error_message}`);
    }

    return data;
  }

  async list(limit: number): Promise<BasicInfo[]> {
    const params = {
      limit,
      sort: 'cmc_rank',
      aux: '',
    };

    const data = await this.get<Array<BasicInfo & { [_: string]: any }>>('/v1/cryptocurrency/map', params);

    return data.map(({ id, rank, name, symbol, slug }): BasicInfo => ({ id, rank, name, symbol, slug }));
  }

  private topItems<T>(obj: Record<string, T[]>): Array<T> {
    return Object.values(obj).map((value) => value[0]);
  }

  private mergeTags(info: any) {
    for (let i = 0; i < info.tags.length; i++) {
      info.tags[i] = {
        slug: info.tags[i],
        name: info['tag-names'][i],
        category: info['tag-groups'][i],
      };
    }

    delete info['tag-names'];
    delete info['tag-groups'];
  }

  private async cached<T extends { id: number; symbol: string}>(
    key: string,
    tokens: string[],
    callback: (tokens: string[]) => Promise<T[]>,
    options?: CacheOptions,
  ): Promise<T[]> {
    const result: Array<T | { symbol: string }> = await Promise.all(
      tokens.map((token) => this.cache
        .get<T>(`coinmarketcap:${key}:${token}`)
        .then((cache) => cache || { symbol: token })
      )
    );

    const remaining = result
      .filter((info) => !('id' in info))
      .map((info) => info.symbol);

    if (remaining.length == 0) {
      return result as T[];
    }

    const newInfo = await callback(remaining);
    await Promise.all(newInfo.map((info) => this.cache.set(`coinmarketcap:${key}:${info.symbol}`, info, options)));

    return [...(result.filter((info): info is T => 'id' in info)), ...newInfo];
  }

  async globalMetrics(options: { refresh?: boolean } = {}): Promise<GlobalMetrics> {
    const cached = !options.refresh ? (await this.cache.get<GlobalMetrics>('coinmarketcap:global-metrics')) : null;

    if (cached) {
      return cached;
    }

    const params = {
      convert: 'USD',
    };

    const metrics = await this.get<GlobalMetrics>('/v1/global-metrics/quotes/latest', params);
    await this.cache.set('coinmarketcap:global-metrics', metrics);

    return metrics;
  }

  async fearAndGreed(options: { refresh?: boolean } = {}): Promise<FearAndGreed> {
    const cached = !options.refresh ? (await this.cache.get<FearAndGreed>('coinmarketcap:fear-and-greed')) : null;

    if (cached) {
      return cached;
    }

    const data = await this.get<FearAndGreed>('/v3/fear-and-greed/latest', {});
    await this.cache.set('coinmarketcap:fear-and-greed', data);

    return data;
  }

  async info(tokens: string[]): Promise<Info[]> {
    return this.cached('info', tokens, async (tokens) => {
      const params = {
        symbol: tokens.join(','),
        skip_invalid: true,
        aux: 'urls,logo,description,tags,platform,date_added,status',
      };

      const data = await this.get<Record<string, Info[]>>('/v2/cryptocurrency/info', params);
      const result = this.topItems(data);

      for (const info of result) {
        this.mergeTags(info);
      }

      return result;
    });
  }

  async price(tokens: string[]): Promise<Price[]> {
    return this.cached('quote', tokens, async (tokens) => {
      const params = {
        symbol: tokens.join(','),
        convert: 'USD',
        skip_invalid: true,
        aux: 'num_market_pairs,cmc_rank,max_supply,circulating_supply,total_supply,is_active,is_fiat,volume_7d,volume_30d',
      };

      const data = await this.get<Record<string, Price[]>>('/v2/cryptocurrency/quotes/latest', params);
      return this.topItems(data);
    }, { expires: Date.now() + 15 * 60 * 1000 /* 15 minute cache */ });
  }

  async about(infos: Array<{ id: number; slug: string; symbol: string; }>): Promise<About[]> {
    const map = new Map<string, typeof infos[number]>(infos.map((info) => [info.symbol, info]));

    return this.cached(
      'about',
      Array.from(map.keys()),
      (tokens) => Promise.all(tokens.map(async (token) => {
        const info = map.get(token);
        const about = await this.fetchAboutSection(info.slug);
        const summary = await this.summarize(about)

        return { id: info.id, symbol: info.symbol, slug: info.slug, content: summary };
      }),
    ));
  }

  private async fetchAboutSection(slug: string): Promise<string> {
    const response = await fetch(`https://coinmarketcap.com/currencies/${slug}`);
    const html = await response.text();

    const $ = cheerio.load(html);

    const aboutSection = $('#section-coin-about');

    const parts = aboutSection.find('> div > div > section > div > div > div').map((_, el) => {
      const section = $(el);
      const title = section.find('h3').text().trim();
      const paragraphs = section.find('p').map((_, el) => this.turndown.turndown($(el).html())).get();

      return `## ${title}\n\n` + paragraphs.join('\n\n');
    }).get();

    return parts.join('\n\n')
  }

  private async summarize(content: string): Promise<string> {
    return await generateText({
      runtime: this.runtime,
      context: [
        'Please summarize the following about section into a single paragraph of maximum of 250 words. No header.',
        'Exclude price, volume, supply and marketcap information.',
        'Exclude links to related sources.',
        '',
        `# About\n\n${content}`,
      ].join('\n'),
      modelClass: ModelClass.LARGE,
    });
  }
}
