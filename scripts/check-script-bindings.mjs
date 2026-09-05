import fs from "node:fs";
import ts from "typescript";

const files = fs.readdirSync("src/scripts", { recursive: true }).filter((file) => file.endsWith(".js")).map((file) => `src/scripts/${file}`);
const program = ts.createProgram(files, { allowJs: true, checkJs: true, noEmit: true, skipLibCheck: true, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler });
const diagnostics = [
  ...program.getSyntacticDiagnostics(),
  ...program.getSemanticDiagnostics().filter((diagnostic) => [1117, 2304, 2552, 18004].includes(diagnostic.code)),
].filter((diagnostic) => diagnostic.file?.fileName.includes("src/scripts/"));
for (const diagnostic of diagnostics) {
  const line = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).line + 1;
  console.error(`${diagnostic.file.fileName}:${line}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`);
}
if (diagnostics.length) process.exitCode = 1;
else console.log(`Browser script syntax and binding checks passed (${files.length} modules).`);
