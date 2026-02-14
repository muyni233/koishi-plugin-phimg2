var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  Config: () => Config,
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(src_exports);
var import_koishi = require("koishi");
var name = "phimg";
var inject = ["database", "http"];
var translationTable = {
  "；": ";",
  "：": ":",
  "，": ",",
  "（": "(",
  "）": ")",
  "【": "[",
  "】": "]",
  "《": "<",
  "》": ">",
  "？": "?",
  "！": "!",
  "。": ".",
  "、": ","
};
function translateText(text) {
  if (!text) return text;
  return text.split("").map((char) => translationTable[char] || char).join("");
}
__name(translateText, "translateText");
var Config = import_koishi.Schema.object({
  apiKey: import_koishi.Schema.string().description("Philomena API 密钥").role("secret").default(""),
  apiUrl: import_koishi.Schema.string().description("Philomena API 域名 (无需 https://)").default("derpibooru.org"),
  defaultTags: import_koishi.Schema.array(String).description("全局默认标签").default(["safe"]),
  enabledByDefault: import_koishi.Schema.boolean().description("新群聊默认启用搜图功能").default(true),
  useGlobalTagsByDefault: import_koishi.Schema.boolean().description("新群聊默认启用全局标签").default(true),
  filterId: import_koishi.Schema.number().description("搜索使用的 Filter ID (例如 100073)").default(100073)
});
function apply(ctx, config) {
  ctx.model.extend("phimg_config", {
    id: "unsigned",
    groupId: "string",
    enabled: "boolean",
    useGlobalTags: "boolean",
    customTags: "list"
  }, {
    autoInc: true,
    primary: "id",
    unique: ["groupId"]
  });
  const getGroupConfig = /* @__PURE__ */ __name(async (groupId) => {
    let [groupConfig] = await ctx.database.get("phimg_config", { groupId });
    if (!groupConfig) {
      try {
        groupConfig = await ctx.database.create("phimg_config", {
          groupId,
          enabled: config.enabledByDefault,
          useGlobalTags: config.useGlobalTagsByDefault,
          customTags: []
        });
      } catch (e) {
        [groupConfig] = await ctx.database.get("phimg_config", { groupId });
      }
    }
    return groupConfig;
  }, "getGroupConfig");
  const updateGroupConfig = /* @__PURE__ */ __name(async (groupId, data) => {
    await getGroupConfig(groupId);
    await ctx.database.set("phimg_config", { groupId }, data);
  }, "updateGroupConfig");
  const makeRequest = /* @__PURE__ */ __name(async (method, params) => {
    const host = config.apiUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const endpoint = `https://${host}/api/v1/json/search/${method}`;
    const queryParams = {
      filter_id: config.filterId
    };
    if (params.key) {
      queryParams.key = params.key;
      delete params.key;
    }
    try {
      let responseData;
      if (method === "images") {
        responseData = await ctx.http.get(endpoint, {
          params: { ...queryParams, ...params },
          headers: { "User-Agent": "Phimg for Koishi" }
        });
      } else {
        responseData = await ctx.http.post(endpoint, params, {
          params: queryParams,
          headers: {
            "User-Agent": "Phimg for Koishi",
            "Content-Type": "application/x-www-form-urlencoded"
          }
        });
      }
      if (!responseData.images || responseData.images.length === 0) {
        throw new Error("未找到匹配的图片");
      }
      return responseData;
    } catch (error) {
      if (error.response?.status === 404) throw new Error("未找到匹配的图片");
      ctx.logger("phimg").warn(error);
      throw new Error(`API 请求失败: ${error.message}`);
    }
  }, "makeRequest");
  const VIDEO_TYPES = ["webm", "mp4"];
  const getMediaElement = /* @__PURE__ */ __name((selected) => {
    if (!selected?.representations) return import_koishi.h.text("图片数据解析错误");
    const file = selected.representations.full;
    const url = file.endsWith(".webm") ? selected.representations.medium : selected.representations.large;
    const fileType = file.split(".").pop()?.toLowerCase() || "";
    if (VIDEO_TYPES.includes(fileType)) {
      return import_koishi.h.video(url);
    }
    return import_koishi.h.image(url);
  }, "getMediaElement");
  const searchHelp = `用法: /搜图 [tags|distance]

可选项:
  --tags             获取当前群聊内置标签列表
  --status           获取当前群聊的搜图功能状态
  --pp [per_page]    每页结果数量，默认为50
  --p [page]         页码，默认为1
  --sf [sf]          排序字段，默认为score
  --sd [sd]          排序方向，默认为desc
  --i [index]        选择结果索引，默认为-1（即随机）

提示: 
  图搜图使用方式为引用图片，默认匹配距离为0.25`;
  const configHelp = `用法: 搜图-c [选项]

可选项:
  --add [tags]       添加标签，多个标签用逗号分隔
  --rm [tags]        删除标签，多个标签用逗号分隔
  --on               开启当前群聊的搜图功能
  --off              关闭当前群聊的搜图功能
  --onglobal         启用全局标签
  --offglobal        关闭全局标签`;
  ctx.command("搜图 [...params]", "从图站搜索图片").option("tags", "--tags").option("status", "--status").option("pp", "--pp <per_page:number>", { fallback: 50 }).option("p", "--p <page:number>", { fallback: 1 }).option("sf", "--sf <sf:string>", { fallback: "score" }).option("sd", "--sd <sd:string>", { fallback: "desc" }).option("i", "--i <index:number>", { fallback: -1 }).action(async ({ session, options }, ...paramsArray) => {
    if (!session?.guildId) return "搜图仅限群聊使用。";
    let params = paramsArray.join(" ").trim();
    if (!params && !session.quote && !options.tags && !options.status) {
      return searchHelp;
    }
    const groupId = session.guildId;
    const groupConfig = await getGroupConfig(groupId);
    if (options.status) {
      return `当前群聊搜图功能状态：
启用：${groupConfig.enabled}
标签：${groupConfig.customTags.join(", ") || "无"}
全局标签：${groupConfig.useGlobalTags ? "启用" : "禁用"}`;
    }
    if (options.tags) {
      return `当前群聊内置标签：${groupConfig.customTags.join(", ") || "无"}`;
    }
    if (!groupConfig.enabled) {
      return '搜图未在本群开启，管理员请用 "搜图-c --on" 启动';
    }
    params = translateText(params || "");
    const cleanParams = params.replace(/<[^>]+>/g, "").trim();
    let imageUrl;
    if (session.quote) {
      const img = import_koishi.h.select(session.quote.content, "image")[0] || import_koishi.h.select(session.quote.content, "img")[0];
      if (img) imageUrl = img.attrs.url || img.attrs.src;
    }
    if (!imageUrl) {
      const img = import_koishi.h.select(session.content, "image")[0] || import_koishi.h.select(session.content, "img")[0];
      if (img) imageUrl = img.attrs.url || img.attrs.src;
    }
    try {
      if (imageUrl) {
        let distance = 0.25;
        if (cleanParams) {
          const parsed = Number(cleanParams);
          if (!isNaN(parsed)) {
            distance = parsed;
          } else {
            return "图片搜索仅支持数字参数，表示相似度距离（distance）。";
          }
        }
        const queryParams = {
          key: config.apiKey,
          url: imageUrl,
          distance
        };
        const data = await makeRequest("reverse", queryParams);
        const images = data.images;
        if (images.length > 10) {
          return `搜索到过多图片 (${images.length} 张)，请尝试减小距离参数。`;
        }
        if (images.length === 0) return "未找到匹配的图片";
        const result = [(0, import_koishi.h)("at", { id: session.userId }), import_koishi.h.text(`
distance: ${distance}
`)];
        for (const img of images) {
          result.push(getMediaElement(img));
          result.push(import_koishi.h.text(`
id: ${img.id} | score: ${img.score}
`));
        }
        return result;
      } else {
        const userTags = cleanParams ? cleanParams.split(",").map((t) => t.trim()).filter((t) => t) : [];
        const globalTags = groupConfig.useGlobalTags ? config.defaultTags : [];
        const groupTags = groupConfig.customTags;
        const allTags = Array.from(/* @__PURE__ */ new Set([...groupTags, ...globalTags, ...userTags]));
        if (allTags.length === 0 && !cleanParams) return "请输入搜索标签。";
        const queryParams = {
          q: allTags.join(", "),
          key: config.apiKey,
          per_page: options.pp,
          page: options.p,
          sf: options.sf,
          sd: options.sd
        };
        const data = await makeRequest("images", queryParams);
        const images = data.images;
        let index = options.i;
        let additionalMsg = "";
        if (index < 0 || index >= images.length) {
          if (index >= 0) additionalMsg = `索引 ${index} 超出单页范围，已随机选择图片`;
          index = Math.floor(Math.random() * images.length);
        }
        const selected = images[index];
        return [
          (0, import_koishi.h)("at", { id: session.userId }),
          getMediaElement(selected),
          import_koishi.h.text(`
id: ${selected.id} | score: ${selected.score}`),
          import_koishi.h.text(`
tags: ${queryParams.q}`),
          additionalMsg ? import_koishi.h.text(`
提示：${additionalMsg}`) : null
        ];
      }
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  });
  const confirmOffGlobal = /* @__PURE__ */ new Set();
  ctx.command("搜图-c", "配置搜图功能", { authority: 3 }).option("on", "--on").option("off", "--off").option("onglobal", "--onglobal").option("offglobal", "--offglobal").option("add", "--add <tags:string>").option("rm", "--rm <tags:string>").action(async ({ session, options }) => {
    if (!session?.guildId) return "搜图配置仅限群聊使用。";
    if (Object.keys(options).length === 0) return configHelp;
    const groupId = session.guildId;
    const groupConfig = await getGroupConfig(groupId);
    let response = "";
    if (options.on && options.off) return "不能同时开启和关闭搜图功能";
    if (options.on) {
      await updateGroupConfig(groupId, { enabled: true });
      response += "搜图功能已在本群开启\n";
    } else if (options.off) {
      await updateGroupConfig(groupId, { enabled: false });
      response += "搜图功能已在本群关闭\n";
    }
    if (options.onglobal && options.offglobal) return "不能同时开启和关闭全局标签";
    if (options.onglobal) {
      await updateGroupConfig(groupId, { useGlobalTags: true });
      response += "全局标签已启用\n";
    } else if (options.offglobal) {
      const confirmKey = `${session.guildId}-${session.userId}`;
      if (!confirmOffGlobal.has(confirmKey)) {
        confirmOffGlobal.add(confirmKey);
        ctx.setTimeout(() => confirmOffGlobal.delete(confirmKey), 6e4);
        return "关闭全局标签，机器人将会搜出非safe图片\n请自行承担风险，再次输入指令确认关闭";
      }
      confirmOffGlobal.delete(confirmKey);
      await updateGroupConfig(groupId, { useGlobalTags: false });
      response += "全局标签已禁用\n";
    }
    if (options.add || options.rm) {
      let newTags = [...groupConfig.customTags];
      if (options.add) {
        const tagsToAdd = translateText(options.add).split(/[,，]/).map((t) => t.trim()).filter((t) => t);
        newTags = [.../* @__PURE__ */ new Set([...newTags, ...tagsToAdd])];
      }
      if (options.rm) {
        const tagsToRm = translateText(options.rm).split(/[,，]/).map((t) => t.trim()).filter((t) => t);
        newTags = newTags.filter((t) => !tagsToRm.includes(t));
      }
      await updateGroupConfig(groupId, { customTags: newTags });
      response += `修改成功，本群标签现为: ${newTags.join(", ") || "无"}
`;
    }
    return response.trim();
  });
}
__name(apply, "apply");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Config,
  apply,
  inject,
  name
});
