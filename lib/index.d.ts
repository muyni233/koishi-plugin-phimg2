import { Context, Schema } from 'koishi';
export declare const name = "phimg2";
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
    filterId: number;
    showErrorLog: boolean;
}
export declare const Config: Schema<Config>;
interface GroupConfig {
    id: number;
    groupId: string;
    enabled: boolean;
    useGlobalTags: boolean;
    customTags: string[];
}
export declare function apply(ctx: Context, config: Config): void;
export {};
