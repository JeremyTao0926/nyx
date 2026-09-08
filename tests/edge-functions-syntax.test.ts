import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

describe("Supabase Edge Functions", () => {
  const root = fileURLToPath(new URL("../supabase/functions/", import.meta.url));
  const functionNames = readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);

  it.each(functionNames)("%s has valid TypeScript syntax", functionName => {
    const filePath = join(root, functionName, "index.ts");
    const source = readFileSync(filePath, "utf8");
    const result = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
      fileName: filePath,
      reportDiagnostics: true,
    });
    const errors = (result.diagnostics || [])
      .filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error)
      .map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
    expect(errors).toEqual([]);
  });
});
