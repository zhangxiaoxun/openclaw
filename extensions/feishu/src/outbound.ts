import fs from "fs";
import path from "path";
import type { ChannelOutboundAdapter } from "openclaw/plugin-sdk";
import { sendMediaFeishu } from "./media.js";
import { getFeishuRuntime } from "./runtime.js";
import { sendMessageFeishu } from "./send.js";

// Check if a path is a local file path (not a URL)
function isLocalPath(str: string | undefined): boolean {
  if (!str) return false;
  // Check if it's an absolute path or relative path (not a URL)
  return (
    str.startsWith("/") ||
    str.startsWith("./") ||
    str.startsWith("../") ||
    /^[a-zA-Z]:\\/.test(str) ||
    (str.includes(":") && !str.startsWith("http"))
  );
}

export const feishuOutbound: ChannelOutboundAdapter = {
  deliveryMode: "direct",
  chunker: (text, limit) => getFeishuRuntime().channel.text.chunkMarkdownText(text, limit),
  chunkerMode: "markdown",
  textChunkLimit: 4000,
  sendText: async ({ cfg, to, text, accountId }) => {
    const result = await sendMessageFeishu({ cfg, to, text, accountId: accountId ?? undefined });
    return { channel: "feishu", ...result };
  },
  sendMedia: async ({ cfg, to, text, mediaUrl, accountId }) => {
    // Send text first if provided
    if (text?.trim()) {
      await sendMessageFeishu({ cfg, to, text, accountId: accountId ?? undefined });
    }

    // Upload and send media if URL or local path provided
    if (mediaUrl) {
      try {
        let result;
        if (isLocalPath(mediaUrl) && fs.existsSync(mediaUrl)) {
          // It's a local file path - read file and send
          const fileName = path.basename(mediaUrl);
          const buffer = fs.readFileSync(mediaUrl);
          result = await sendMediaFeishu({
            cfg,
            to,
            mediaBuffer: buffer,
            fileName,
            accountId: accountId ?? undefined,
          });
        } else {
          // It's a URL - use existing logic
          result = await sendMediaFeishu({
            cfg,
            to,
            mediaUrl,
            accountId: accountId ?? undefined,
          });
        }
        return { channel: "feishu", ...result };
      } catch (err) {
        // Log the error for debugging
        console.error(`[feishu] sendMediaFeishu failed:`, err);
        // Fallback to URL/link if upload fails
        const fallbackText = isLocalPath(mediaUrl)
          ? `📎 本地文件: ${path.basename(mediaUrl)}`
          : `📎 ${mediaUrl}`;
        const result = await sendMessageFeishu({
          cfg,
          to,
          text: fallbackText,
          accountId: accountId ?? undefined,
        });
        return { channel: "feishu", ...result };
      }
    }

    // No media URL, just return text result
    const result = await sendMessageFeishu({
      cfg,
      to,
      text: text ?? "",
      accountId: accountId ?? undefined,
    });
    return { channel: "feishu", ...result };
  },
};
