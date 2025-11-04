import "dotenv/config";
import { TextEncoder } from "node:util";

import { uploadTemplateAsset } from "../lib/storage";

async function main() {
  const encoder = new TextEncoder();
  const payload = encoder.encode(
    JSON.stringify(
      {
        hello: "world",
        timestamp: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  const result = await uploadTemplateAsset(
    {
      templateKey: "sample-template",
      version: 1,
      type: "config",
      fileName: "sample.json",
      data: payload,
      contentType: "application/json",
    },
    { upsert: true },
  );

  console.log("Uploaded to Supabase Storage:", result);
}

main().catch((error) => {
  console.error("Upload failed:", error);
  process.exit(1);
});
