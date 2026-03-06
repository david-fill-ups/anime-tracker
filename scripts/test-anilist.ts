import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { GraphQLClient } from "graphql-request";
const client = new GraphQLClient("https://graphql.anilist.co");

try {
  const data = await client.request(
    "query($id: Int!) { Media(id: $id, type: ANIME) { id title { romaji } } }",
    { id: 20 }
  );
  console.log("success:", JSON.stringify(data));
} catch (e: any) {
  console.error("error type:", e?.constructor?.name);
  console.error("error message:", e?.message);
  console.error("error status:", e?.response?.status);
  console.error("full error:", JSON.stringify(e, null, 2));
}
