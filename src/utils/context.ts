import {
  Content,
  formatMessages,
  getActorDetails,
  generateObject,
  IAgentRuntime,
  Memory,
  ModelClass,
  State, embed, elizaLogger
} from "@elizaos/core"
import { z } from "zod"
import { BasicInfo } from "../types.ts"

const tokenSchema = z.object({
  symbol: z.string().nullable().describe('The symbol of the cryptocurrency'),
  name: z.string().nullable().describe('The project name of the cryptocurrency'),
});
export type Token = z.infer<typeof tokenSchema>;

const tokenListSchema = z.array(tokenSchema).describe('List of cryptocurrencies or crypto tokens discussed by the user');
const tokenListResultSchema = z.object({
  tokens: tokenListSchema,
});
export type TokenList = z.infer<typeof tokenListSchema>;
type TokenListResultContext = z.infer<typeof tokenListResultSchema> & Content;

const template = `
Assume all user messages are in the context of cryptocurrency. Your task is to identify any cryptocurrencies or crypto
tokens discussed in the user messages, including indirect references like memes, cultural events, or token nicknames. 
If the user refers to a meme or cultural event, assume it could be a meme coin unless explicitly ruled out.

Here are the user messages for context:
{{recentMessages}}

Which cryptocurrencies or crypto tokens does the user discuss in the most recent message (from just now)?
If the user compares the token(s) of the most recent message to other tokens, include those tokens as well in the
response.

Respond with a JSON array of ticker symbols and/or project names. For well-known crypto projects, always include the
ticker symbol. If the message is not related to any specific token, the \`tokens\` array should be empty.

A token ticker is three to five alphanumeric characters, typically in all-caps or prefixed with a dollar sign (eg ETH,
$ETH or $eth). A project name generally is not in all-caps (eg Ethereum or ethereum).

### Examples:  
(just now) User: How about this Trump meme?  
**Expected Output:**  
\`\`\`json
{
  "tokens": [
    { "symbol": null, "name": "Trump meme" }
  ]
}
\`\`\`  

---

(just now) User: Is it better than Dogecoin?
(1 minute ago) cryptobrobot: Man it's Ah, the $TRUMP token, bro! It's like the ultimate meme coin rollercoaster.  
(1 minute ago) User: How about this Trump meme?
(2 hours ago) cryptobrobot: The price of $ETH is $3400. It's down by 0.4% today. What a snooze fest.  
(2 hours ago) User: What is the price of Ethereum?
**Expected Output:**  
\`\`\`json
{
  "tokens": [
    { "symbol": 'TRUMP', "name": "Trump meme" },
    { "symbol": "DOGE", "name": "Dogecoin" }
  ]
}
\`\`\`  

---

**User Message:** What can you tell me about Florence Finance and LTO?
Example:
\`\`\`json
{
  "tokens": [
    { "symbol": null, "name": "Florence Finance" }
    { "symbol": "LTO", "name": null },
  ]
}
\`\`\`
`

function isTokenListResult(obj: any): obj is TokenListResultContext {
  return tokenListResultSchema.safeParse(obj).success;
}

function isToken(obj: any): obj is Token {
  return tokenSchema.safeParse(obj).success;
}

export async function getTokensFromContext(runtime: IAgentRuntime, message: Memory, state: State): Promise<TokenList> {
  const actors = await getActorDetails({ runtime: runtime, roomId: message.roomId });

  const context = template.replace('{{recentMessages}}', formatMessages({ messages: state?.recentMessagesData ?? [], actors }));

  const result = await generateObject({
    runtime,
    context,
    modelClass: ModelClass.LARGE,
    schema: tokenListResultSchema as any, // zod compatibility issue
  });

  if (!isTokenListResult(result.object)) {
    throw new Error("Invalid token list response format");
  }

  return result.object.tokens;
}

const tokenSymbolTemplate = `
What is the ticker symbol of {{token}}?
 
It could be one of these:
{{knowledge}}

Respond with a JSON object of the ticker symbol and project name.

If there multiple possibilities which are equally possible, pick the one with the highest rank.
If it unlikely to be one of the mentioned projects, respond with null.
`;

export async function figureOutTokenSymbol(runtime: IAgentRuntime, token: string): Promise<Token | null> {
  const cached = await runtime.cacheManager.get<BasicInfo>(`token-by-name:${token.toLowerCase()}`);
  if (cached) {
    return { name: cached.name, symbol: cached.symbol };
  }

  elizaLogger.log(`Figuring out token symbol for ${token}`);

  const embeddings = await embed(runtime, `is ${token.toLowerCase()} known on coinmarketcap?`);

  const memories = await runtime.getMemoryManager('cmc_tokens').searchMemoriesByEmbedding(embeddings, {
    roomId: runtime.agentId,
    count: 5,
  });

  const knowledge = memories.map((memory) => ` - ${memory.content.text}`).join('\n');

  const context = tokenSymbolTemplate
    .replace('{{token}}', token)
    .replace('{{knowledge}}', knowledge);

  elizaLogger.log('CONTEXT: ' + context);

  const result = await generateObject({
    runtime,
    context,
    modelClass: ModelClass.LARGE,
    schema: tokenSchema as any, // zod compatibility issue
  });

  if (!isToken(result.object) || !result.object.symbol) {
    return { name: token, symbol: null };
  }

  return { name: result.object.name, symbol: result.object.symbol.toUpperCase() };
}
