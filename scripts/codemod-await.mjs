// One-off codemod: make data access awaited and typed through the shared Db interface.
import { readFileSync, writeFileSync } from "node:fs";

const files = process.argv.slice(2);

const rules = [
  // const x = db\n    .prepare(  ->  await db
  [/\b(\w+) = db(\r?\n\s*)\.prepare\(/g, "$1 = await db$2.prepare("],
  [/\b(\w+) = db\.prepare\(/g, "$1 = await db.prepare("],
  // .all(args) as Array<{ ... }>;
  [/\.all\(([^()]*)\) as Array<\{([\s\S]*?)\}>;/g, ".all<{$2}>($1);"],
  // .all(args) as Type[];
  [/\.all\(([^()]*)\) as (\w+)\[\];/g, ".all<$2>($1);"],
  // .get(args) as { ... } | undefined;
  [/\.get\(([^()]*)\) as \{([^{}]*)\} \| undefined;/g, ".get<{$2}>($1);"],
  // .get(args) as { ... };
  [/\.get\(([^()]*)\) as \{([^{}]*)\};/g, ".get<{$2}>($1);"],
];

for (const file of files) {
  let source = readFileSync(file, "utf8");
  let changes = 0;
  for (const [pattern, replacement] of rules) {
    source = source.replace(pattern, (...args) => {
      changes += 1;
      const [, ...groups] = args;
      return replacement.replace(/\$(\d)/g, (_, index) => String(groups[Number(index) - 1] ?? ""));
    });
  }
  writeFileSync(file, source);
  console.log(`${changes.toString().padStart(3)}  ${file}`);
}
