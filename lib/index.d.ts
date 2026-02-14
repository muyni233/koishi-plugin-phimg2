import { Context, Schema } from 'koishi';
export declare const inject: string[];
declare module 'koishi' {
    interface Tables {
        phimg_config: GroupConfig;
    }
}
export interface Config {
    apiKey: string;
    apiUrl: string;
    defaultTags: string[];
    enabledByDefault: boolean;
    useGlobalTagsByDefault: boolean;
    proxy: string;
    timeout: number;
}
export declare const Config: Schema<Config>;
interface GroupConfig {
    id?: number;
    groupId: string;
    enabled: boolean;
    useGlobalTags: boolean;
    customTags: string[];
}
export declare function apply(ctx: Context, config: Config): void;
export {};
