// Types pour Redis (optionnel)
declare module 'redis' {
  export interface RedisClient {
    get(key: string): Promise<string | null>;
    setEx(key: string, ttl: number, value: string): Promise<void>;
    del(key: string): Promise<void>;
    connect(): Promise<void>;
  }

  export function createClient(options: { url: string }): RedisClient;
}
