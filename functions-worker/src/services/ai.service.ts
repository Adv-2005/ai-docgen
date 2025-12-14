// functions-worker/src/services/ai.service.ts
import * as functions from "firebase-functions";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { FileAnalysis } from "./analysis.services";

export interface DocumentationResult {
  type: "onboarding" | "architecture" | "api" | "change-summary" | "pr-summary";
  title: string;
  content: string;
  metadata: {
    generatedAt: Date;
    model: string;
    tokensUsed?: number;
  };
}

/**
 * AI Service for generating documentation using Google Gemini (FREE)
 */
export class AIService {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private modelName: string;

  constructor() {

    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      functions.logger.warn("GEMINI_API_KEY not set, using mock mode");
      this.genAI = null as any;
      this.model = null;
      this.modelName = "mock";
    } else {
      this.genAI = new GoogleGenerativeAI(apiKey);
      // Updated model name for the current API
      this.modelName = "models/gemini-flash-latest"; // Free tier model
      this.model = this.genAI.getGenerativeModel({ model: this.modelName });
      
      functions.logger.info("Gemini AI initialized", { model: this.modelName });
    }
  }

  /**
   * Check if AI is available
   */
  isAvailable(): boolean {
    return this.model !== null;
  }

  /**
   * Generate PR summary documentation
   */
  async generatePRSummary(
    prNumber: number,
    filesAnalyzed: FileAnalysis[],
    commits: Array<{ message: string; author: string }>,
    additions: number,
    deletions: number
  ): Promise<DocumentationResult> {
    functions.logger.info("Generating PR summary", { 
      prNumber, 
      filesCount: filesAnalyzed.length,
      aiAvailable: this.isAvailable()
    });

    if (!this.isAvailable()) {
      return this.generateFallbackPRSummary(prNumber, filesAnalyzed, additions, deletions);
    }

    const prompt = this.buildPRSummaryPrompt(
      prNumber,
      filesAnalyzed,
      commits,
      additions,
      deletions
    );

    try {
      const response = await this.callGemini(prompt);

      return {
        type: "pr-summary",
        title: `Pull Request #${prNumber} Documentation`,
        content: response,
        metadata: {
          generatedAt: new Date(),
          model: this.modelName,
        },
      };
    } catch (error) {
      functions.logger.error("Failed to generate PR summary with AI", {
        error: error instanceof Error ? error.message : String(error),
      });

      return this.generateFallbackPRSummary(prNumber, filesAnalyzed, additions, deletions);
    }
  }

  /**
   * Generate function/class documentation
   */
  async generateAPIDocumentation(
    filePath: string,
    fileAnalysis: FileAnalysis
  ): Promise<DocumentationResult> {
    functions.logger.info("Generating API documentation", { 
      filePath,
      aiAvailable: this.isAvailable()
    });

    if (!this.isAvailable()) {
      return this.generateFallbackAPIDoc(filePath, fileAnalysis);
    }

    const prompt = this.buildAPIDocPrompt(filePath, fileAnalysis);

    try {
      const response = await this.callGemini(prompt);

      return {
        type: "api",
        title: `API Documentation: ${filePath}`,
        content: response,
        metadata: {
          generatedAt: new Date(),
          model: this.modelName,
        },
      };
    } catch (error) {
      functions.logger.error("Failed to generate API documentation with AI", {
        error: error instanceof Error ? error.message : String(error),
      });

      return this.generateFallbackAPIDoc(filePath, fileAnalysis);
    }
  }

  /**
   * Generate architecture overview
   */
  async generateArchitectureOverview(
    repoName: string,
    filesAnalyzed: FileAnalysis[]
  ): Promise<DocumentationResult> {
    functions.logger.info("Generating architecture overview", { 
      repoName, 
      filesCount: filesAnalyzed.length,
      aiAvailable: this.isAvailable()
    });

    if (!this.isAvailable()) {
      return this.generateFallbackArchitecture(repoName, filesAnalyzed);
    }

    const prompt = this.buildArchitecturePrompt(repoName, filesAnalyzed);

    try {
      const response = await this.callGemini(prompt);

      return {
        type: "architecture",
        title: `${repoName} - Architecture Overview`,
        content: response,
        metadata: {
          generatedAt: new Date(),
          model: this.modelName,
        },
      };
    } catch (error) {
      functions.logger.error("Failed to generate architecture overview with AI", {
        error: error instanceof Error ? error.message : String(error),
      });

      return this.generateFallbackArchitecture(repoName, filesAnalyzed);
    }
  }

  /**
   * Generate onboarding guide
   */
  async generateOnboardingGuide(
    repoName: string,
    filesAnalyzed: FileAnalysis[]
  ): Promise<DocumentationResult> {
    functions.logger.info("Generating onboarding guide", { 
      repoName,
      aiAvailable: this.isAvailable()
    });

    if (!this.isAvailable()) {
      return this.generateFallbackOnboarding(repoName, filesAnalyzed);
    }

    const prompt = this.buildOnboardingPrompt(repoName, filesAnalyzed);

    try {
      const response = await this.callGemini(prompt);

      return {
        type: "onboarding",
        title: `${repoName} - Developer Onboarding Guide`,
        content: response,
        metadata: {
          generatedAt: new Date(),
          model: this.modelName,
        },
      };
    } catch (error) {
      functions.logger.error("Failed to generate onboarding guide with AI", {
        error: error instanceof Error ? error.message : String(error),
      });

      return this.generateFallbackOnboarding(repoName, filesAnalyzed);
    }
  }

  /**
   * Call Gemini API
   */
  private async callGemini(prompt: string): Promise<string> {
    if (!this.model) {
      throw new Error("Gemini model not initialized");
    }

    const result = await this.model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  }

  /**
   * Build PR summary prompt
   */
  private buildPRSummaryPrompt(
    prNumber: number,
    filesAnalyzed: FileAnalysis[],
    commits: Array<{ message: string; author: string }>,
    additions: number,
    deletions: number
  ): string {
    const filesSummary = filesAnalyzed
      .slice(0, 10) // Limit to first 10 files to stay within token limits
      .map((f) => {
        const functionsInfo = f.functions.length > 0
          ? ` | Functions: ${f.functions.map((fn) => fn.name).slice(0, 5).join(", ")}`
          : "";
        const classesInfo = f.classes.length > 0
          ? ` | Classes: ${f.classes.map((c) => c.name).slice(0, 3).join(", ")}`
          : "";
        return `- ${f.filePath} (${f.linesOfCode} LOC)${functionsInfo}${classesInfo}`;
      })
      .join("\n");

    const commitsSummary = commits
      .slice(0, 5)
      .map((c) => `- ${c.message}`)
      .join("\n");

    return `Generate a professional Pull Request documentation summary.

**PR #${prNumber} Statistics:**
- ${filesAnalyzed.length} files changed
- +${additions}/-${deletions} lines

**Modified Files:**
${filesSummary}

**Recent Commits:**
${commitsSummary}

**Generate markdown documentation with:**
1. **Summary** (2-3 sentences) - What does this PR accomplish?
2. **Key Changes** - List main changes by file (bullet points)
3. **Impact** - Rate as Low/Medium/High and explain why
4. **Testing Notes** - What reviewers should test
5. **Review Focus** - Critical areas needing attention

Keep it concise and actionable for developers.`;
  }

  /**
   * Build API documentation prompt
   */
  private buildAPIDocPrompt(filePath: string, fileAnalysis: FileAnalysis): string {
    const functionsInfo = fileAnalysis.functions
      .slice(0, 10)
      .map((f) => {
        return `- **${f.name}**(${f.params.join(", ")}): ${f.isAsync ? "async" : "sync"} ${f.type}`;
      })
      .join("\n");

    const classesInfo = fileAnalysis.classes
      .slice(0, 5)
      .map((c) => {
        return `- **${c.name}**: ${c.methods.length} methods, ${c.properties.length} properties`;
      })
      .join("\n");

    return `Generate API documentation for this code file.

**File:** ${filePath}
**Language:** ${fileAnalysis.language}
**Exports:** ${fileAnalysis.exports.join(", ") || "none"}

**Functions:**
${functionsInfo || "No functions"}

**Classes:**
${classesInfo || "No classes"}

**Generate concise documentation:**
1. **Purpose** (1-2 sentences)
2. **Key Exports** - Document main functions/classes
3. **Usage Example** - Show basic usage
4. **Dependencies** - Note important imports

Format as clean markdown. Be concise but informative.`;
  }

  /**
   * Build architecture overview prompt
   */
  private buildArchitecturePrompt(
    repoName: string,
    filesAnalyzed: FileAnalysis[]
  ): string {
    const filesByLanguage = filesAnalyzed.reduce((acc, f) => {
      acc[f.language] = (acc[f.language] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalFunctions = filesAnalyzed.reduce((sum, f) => sum + f.functions.length, 0);
    const totalClasses = filesAnalyzed.reduce((sum, f) => sum + f.classes.length, 0);
    const totalLOC = filesAnalyzed.reduce((sum, f) => sum + f.linesOfCode, 0);

    const keyFiles = filesAnalyzed
      .slice(0, 15)
      .map((f) => `- ${f.filePath}`)
      .join("\n");

    return `Generate an architecture overview for this codebase.

**Repository:** ${repoName}
**Statistics:**
- ${filesAnalyzed.length} files analyzed
- ${totalLOC} total lines of code
- ${totalFunctions} functions, ${totalClasses} classes

**Languages:** ${Object.entries(filesByLanguage).map(([lang, count]) => `${lang} (${count})`).join(", ")}

**Key Files:**
${keyFiles}

**Generate documentation with:**
1. **Overview** - What does this project do? (2-3 sentences)
2. **Tech Stack** - List technologies used
3. **Structure** - Explain folder/file organization
4. **Key Components** - Main modules and their purpose
5. **Getting Started** - High-level setup steps

Keep it developer-friendly and concise.`;
  }

  /**
   * Build onboarding guide prompt
   */
  private buildOnboardingPrompt(
    repoName: string,
    filesAnalyzed: FileAnalysis[]
  ): string {
    const languages = [...new Set(filesAnalyzed.map((f) => f.language))].join(", ");
    
    return `Generate a developer onboarding guide for new team members.

**Project:** ${repoName}
**Languages:** ${languages}
**Codebase Size:** ${filesAnalyzed.length} files

**Create an onboarding guide with:**
1. **Welcome** - Brief project introduction
2. **Prerequisites** - What you need installed (Node.js, etc.)
3. **Setup Steps** - How to get the project running locally
4. **Project Structure** - Where to find different components
5. **First Contribution** - Guide to making your first PR
6. **Resources** - Links to key documentation

Make it welcoming and easy to follow for junior developers.`;
  }

  /**
   * Fallback PR summary (no AI)
   */
  private generateFallbackPRSummary(
    prNumber: number,
    filesAnalyzed: FileAnalysis[],
    additions: number,
    deletions: number
  ): DocumentationResult {
    const fileList = filesAnalyzed
      .map((f) => `- \`${f.filePath}\` (${f.linesOfCode} lines, ${f.functions.length} functions)`)
      .join("\n");

    const content = `# Pull Request #${prNumber} Summary

## Overview
This PR modifies ${filesAnalyzed.length} files with +${additions}/-${deletions} lines changed.

## Files Changed
${fileList}

## Statistics
- **Total Functions**: ${filesAnalyzed.reduce((sum, f) => sum + f.functions.length, 0)}
- **Total Classes**: ${filesAnalyzed.reduce((sum, f) => sum + f.classes.length, 0)}
- **Languages**: ${[...new Set(filesAnalyzed.map(f => f.language))].join(", ")}

---
*Note: AI-generated documentation unavailable. Set GEMINI_API_KEY for enhanced summaries.*`;

    return {
      type: "pr-summary",
      title: `Pull Request #${prNumber} Documentation`,
      content,
      metadata: {
        generatedAt: new Date(),
        model: "fallback",
      },
    };
  }

  /**
   * Fallback API documentation (no AI)
   */
  private generateFallbackAPIDoc(
    filePath: string,
    fileAnalysis: FileAnalysis
  ): DocumentationResult {
    const functionsDoc = fileAnalysis.functions
      .map((f) => {
        return `### ${f.name}
- **Type**: ${f.type}
- **Parameters**: ${f.params.join(", ") || "none"}
- **Async**: ${f.isAsync ? "Yes" : "No"}
- **Exported**: ${f.isExported ? "Yes" : "No"}`;
      })
      .join("\n\n");

    const classesDoc = fileAnalysis.classes
      .map((c) => {
        return `### Class: ${c.name}
- **Methods**: ${c.methods.map((m) => m.name).join(", ") || "none"}
- **Properties**: ${c.properties.join(", ") || "none"}
- **Exported**: ${c.isExported ? "Yes" : "No"}`;
      })
      .join("\n\n");

    const content = `# API Documentation: ${filePath}

## Overview
- **Language**: ${fileAnalysis.language}
- **Lines of Code**: ${fileAnalysis.linesOfCode}
- **Exports**: ${fileAnalysis.exports.join(", ") || "none"}

## Functions
${functionsDoc || "*No functions found*"}

## Classes
${classesDoc || "*No classes found*"}

## Imports
${fileAnalysis.imports.map((i) => `- ${i.source}`).join("\n") || "*No imports*"}

---
*Note: AI-enhanced documentation unavailable. Set GEMINI_API_KEY for detailed explanations.*`;

    return {
      type: "api",
      title: `API Documentation: ${filePath}`,
      content,
      metadata: {
        generatedAt: new Date(),
        model: "fallback",
      },
    };
  }

  /**
   * Fallback architecture doc (no AI)
   */
  private generateFallbackArchitecture(
    repoName: string,
    filesAnalyzed: FileAnalysis[]
  ): DocumentationResult {
    const langStats = filesAnalyzed.reduce((acc, f) => {
      acc[f.language] = (acc[f.language] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const content = `# ${repoName} - Architecture Overview

## Project Statistics
- **Total Files**: ${filesAnalyzed.length}
- **Total Functions**: ${filesAnalyzed.reduce((s, f) => s + f.functions.length, 0)}
- **Total Classes**: ${filesAnalyzed.reduce((s, f) => s + f.classes.length, 0)}
- **Total Lines**: ${filesAnalyzed.reduce((s, f) => s + f.linesOfCode, 0)}

## Technology Stack
${Object.entries(langStats).map(([lang, count]) => `- **${lang}**: ${count} files`).join("\n")}

## File Structure
${filesAnalyzed.slice(0, 20).map(f => `- ${f.filePath}`).join("\n")}

---
*Note: AI-generated architecture analysis unavailable. Set GEMINI_API_KEY for enhanced documentation.*`;

    return {
      type: "architecture",
      title: `${repoName} - Architecture Overview`,
      content,
      metadata: {
        generatedAt: new Date(),
        model: "fallback",
      },
    };
  }

  /**
   * Fallback onboarding doc (no AI)
   */
  private generateFallbackOnboarding(
    repoName: string,
    filesAnalyzed: FileAnalysis[]
  ): DocumentationResult {
    const languages = [...new Set(filesAnalyzed.map((f) => f.language))].join(", ");

    const content = `# ${repoName} - Developer Onboarding

## Welcome!
Welcome to the ${repoName} project.

## Tech Stack
- **Languages**: ${languages}
- **Files**: ${filesAnalyzed.length}

## Getting Started
1. Clone the repository
2. Install dependencies
3. Run the development server
4. Start contributing!

## Project Structure
${filesAnalyzed.slice(0, 15).map(f => `- \`${f.filePath}\``).join("\n")}

---
*Note: AI-enhanced onboarding guide unavailable. Set GEMINI_API_KEY for personalized guidance.*`;

    return {
      type: "onboarding",
      title: `${repoName} - Developer Onboarding Guide`,
      content,
      metadata: {
        generatedAt: new Date(),
        model: "fallback",
      },
    };
  }
}