import { writeFileSync, mkdirSync } from "fs";

const dir = "./app/generated/prisma";
const content = 'export * from "./client";\nexport * from "./enums";\n';

mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/index.ts`, content);
console.log(`Created ${dir}/index.ts`);
