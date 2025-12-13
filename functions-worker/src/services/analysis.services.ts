// functions-worker/src/services/analysis.service.ts
import * as functions from "firebase-functions";
import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import * as t from "@babel/types";
import * as path from "path";

export interface FunctionInfo {
  name: string;
  type: "function" | "arrow" | "method";
  params: string[];
  isAsync: boolean;
  isExported: boolean;
  line: number;
  endLine: number;
  docComment?: string;
}

export interface ClassInfo {
  name: string;
  methods: FunctionInfo[];
  properties: string[];
  isExported: boolean;
  extendsFrom?: string;
  line: number;
  endLine: number;
  docComment?: string;
}

export interface ImportInfo {
  source: string;
  imports: string[];
  isDefault: boolean;
}

export interface FileAnalysis {
  filePath: string;
  language: string;
  functions: FunctionInfo[];
  classes: ClassInfo[];
  imports: ImportInfo[];
  exports: string[];
  linesOfCode: number;
  complexity?: number;
}

export interface DeltaAnalysis {
  changedFiles: FileAnalysis[];
  addedFunctions: Array<{ file: string; function: FunctionInfo }>;
  modifiedFunctions: Array<{ file: string; function: FunctionInfo }>;
  deletedFunctions: Array<{ file: string; functionName: string }>;
  addedClasses: Array<{ file: string; class: ClassInfo }>;
  modifiedClasses: Array<{ file: string; class: ClassInfo }>;
  summary: {
    filesAnalyzed: number;
    functionsChanged: number;
    classesChanged: number;
    totalLinesChanged: number;
  };
}

/**
 * Service for semantic code analysis
 */
export class AnalysisService {
  
  /**
   * Analyze a single file
   */
  async analyzeFile(filePath: string, content: string): Promise<FileAnalysis> {
    const language = this.detectLanguage(filePath);
    
    functions.logger.info("Analyzing file", { filePath, language });

    try {
      if (language === "typescript" || language === "javascript") {
        return await this.analyzeJavaScriptFile(filePath, content, language);
      } else {
        // For other languages, return basic analysis
        return this.basicAnalysis(filePath, content, language);
      }
    } catch (error) {
      functions.logger.error("Failed to analyze file", {
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
      
      // Return basic analysis on error
      return this.basicAnalysis(filePath, content, language);
    }
  }

  /**
   * Analyze JavaScript/TypeScript file using Babel
   */
  private async analyzeJavaScriptFile(
    filePath: string,
    content: string,
    language: string
  ): Promise<FileAnalysis> {
    const functionInfos: FunctionInfo[] = [];
    const classes: ClassInfo[] = [];
    const imports: ImportInfo[] = [];
    const exports: string[] = [];
    const self = this;

    try {
      // Parse with Babel
      const ast = parse(content, {
        sourceType: "module",
        plugins: [
          "typescript",
          "jsx",
          "decorators-legacy",
          "classProperties",
          "objectRestSpread",
          "asyncGenerators",
          "dynamicImport",
        ],
      });

      // Traverse AST
      traverse(ast, {
        // Function declarations
        FunctionDeclaration(path) {
          const node = path.node;
          const func: FunctionInfo = {
            name: node.id?.name || "anonymous",
            type: "function",
            params: node.params.map((p) => (t.isIdentifier(p) ? p.name : "...")),
            isAsync: node.async,
            isExported: self.isExported(path),
            line: node.loc?.start.line || 0,
            endLine: node.loc?.end.line || 0,
            ...(self.extractDocComment(path) && { docComment: self.extractDocComment(path) }),
          };
          functionInfos.push(func);

          if (func.isExported) {
            exports.push(func.name);
          }
        },

        // Arrow functions and function expressions
        VariableDeclaration(path) {
          path.node.declarations.forEach((decl) => {
            if (
              t.isIdentifier(decl.id) &&
              (t.isArrowFunctionExpression(decl.init) ||
                t.isFunctionExpression(decl.init))
            ) {
              const func: FunctionInfo = {
                name: decl.id.name,
                type: t.isArrowFunctionExpression(decl.init) ? "arrow" : "function",
                params: decl.init.params.map((p) =>
                  t.isIdentifier(p) ? p.name : "..."
                ),
                isAsync: decl.init.async,
                isExported: self.isExported(path),
                line: decl.loc?.start.line || 0,
                endLine: decl.loc?.end.line || 0,
                ...(self.extractDocComment(path) && { docComment: self.extractDocComment(path) }),
              };
              functionInfos.push(func);

              if (func.isExported) {
                exports.push(func.name);
              }
            }
          });
        },

        // Class declarations
        ClassDeclaration(path) {
          const node = path.node;
          const methods: FunctionInfo[] = [];
          const properties: string[] = [];

          node.body.body.forEach((member) => {
            if (t.isClassMethod(member) && t.isIdentifier(member.key)) {
              methods.push({
                name: member.key.name,
                type: "method",
                params: member.params.map((p) => (t.isIdentifier(p) ? p.name : "...")),
                isAsync: member.async,
                isExported: false,
                line: member.loc?.start.line || 0,
                endLine: member.loc?.end.line || 0,
              });
            } else if (t.isClassProperty(member) && t.isIdentifier(member.key)) {
              properties.push(member.key.name);
            }
          });

          const classInfo: ClassInfo = {
            name: node.id?.name || "anonymous",
            methods,
            properties,
            isExported: self.isExported(path),
            ...(t.isIdentifier(node.superClass) && { extendsFrom: node.superClass.name }),
            line: node.loc?.start.line || 0,
            endLine: node.loc?.end.line || 0,
            ...(self.extractDocComment(path) && { docComment: self.extractDocComment(path) }),
          };

          classes.push(classInfo);

          if (classInfo.isExported) {
            exports.push(classInfo.name);
          }
        },

        // Import statements
        ImportDeclaration(path) {
          const node = path.node;
          const importInfo: ImportInfo = {
            source: node.source.value,
            imports: node.specifiers.map((spec) => {
              if (t.isImportDefaultSpecifier(spec)) {
                return spec.local.name;
              } else if (t.isImportSpecifier(spec)) {
                return t.isIdentifier(spec.imported)
                  ? spec.imported.name
                  : "unknown";
              }
              return "namespace";
            }),
            isDefault: node.specifiers.some((s) => t.isImportDefaultSpecifier(s)),
          };
          imports.push(importInfo);
        },

        // Named exports
        ExportNamedDeclaration(path) {
          path.node.specifiers.forEach((spec) => {
            if (t.isExportSpecifier(spec) && t.isIdentifier(spec.exported)) {
              exports.push(spec.exported.name);
            }
          });
        },
      });

      const linesOfCode = content.split("\n").length;

      return {
        filePath,
        language,
        functions:functionInfos,
        classes,
        imports,
        exports,
        linesOfCode,
      };

    } catch (error) {
      functions.logger.error("Babel parsing failed", {
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Basic analysis for non-JS files or fallback
   */
  private basicAnalysis(
    filePath: string,
    content: string,
    language: string
  ): FileAnalysis {
    return {
      filePath,
      language,
      functions: [],
      classes: [],
      imports: [],
      exports: [],
      linesOfCode: content.split("\n").length,
    };
  }

  /**
   * Detect programming language from file extension
   */
  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
      ".js": "javascript",
      ".jsx": "javascript",
      ".ts": "typescript",
      ".tsx": "typescript",
      ".py": "python",
      ".java": "java",
      ".go": "go",
      ".rb": "ruby",
      ".php": "php",
      ".cs": "csharp",
      ".cpp": "cpp",
      ".c": "c",
    };
    return languageMap[ext] || "unknown";
  }

  /**
   * Check if node is exported
   */
  private isExported(path: any): boolean {
    if (!path.parent) return false;
    
    return (
      t.isExportNamedDeclaration(path.parent) ||
      t.isExportDefaultDeclaration(path.parent)
    );
  }

  /**
   * Extract JSDoc comment
   */
  private extractDocComment(path: any): string | undefined {
    const comments = path.node.leadingComments;
    if (!comments || comments.length === 0) return undefined;

    const lastComment = comments[comments.length - 1];
    if (lastComment.type === "CommentBlock" && lastComment.value.startsWith("*")) {
      return lastComment.value.trim();
    }

    return undefined;
  }

  /**
   * Compare two file analyses to detect changes
   */
  compareFunctions(
    before: FunctionInfo[],
    after: FunctionInfo[]
  ): {
    added: FunctionInfo[];
    modified: FunctionInfo[];
    deleted: string[];
  } {
    const beforeMap = new Map(before.map((f) => [f.name, f]));
    const afterMap = new Map(after.map((f) => [f.name, f]));

    const added: FunctionInfo[] = [];
    const modified: FunctionInfo[] = [];
    const deleted: string[] = [];

    // Find added and modified
    afterMap.forEach((afterFunc, name) => {
      const beforeFunc = beforeMap.get(name);
      if (!beforeFunc) {
        added.push(afterFunc);
      } else if (this.isFunctionModified(beforeFunc, afterFunc)) {
        modified.push(afterFunc);
      }
    });

    // Find deleted
    beforeMap.forEach((_, name) => {
      if (!afterMap.has(name)) {
        deleted.push(name);
      }
    });

    return { added, modified, deleted };
  }

  /**
   * Check if function signature changed
   */
  private isFunctionModified(before: FunctionInfo, after: FunctionInfo): boolean {
    return (
      before.params.length !== after.params.length ||
      before.isAsync !== after.isAsync ||
      JSON.stringify(before.params) !== JSON.stringify(after.params)
    );
  }
}