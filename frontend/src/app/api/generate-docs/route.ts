// frontend/src/app/api/generate-docs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { Octokit } from '@octokit/rest';

// Allow up to 60s for doc generation
export const maxDuration = 60;

// ── Firebase Admin Setup ───────────────────────────────────────────
let firebaseReady = false;

if (getApps().length === 0) {
  const pk = process.env.FIREBASE_PRIVATE_KEY;
  const pid = process.env.FIREBASE_PROJECT_ID;
  const ce = process.env.FIREBASE_CLIENT_EMAIL;

  if (pk && pid && ce) {
    try {
      let processedKey = pk;
      if (processedKey.startsWith('"') && processedKey.endsWith('"')) {
        processedKey = processedKey.slice(1, -1);
      }
      processedKey = processedKey.replace(/\\n/g, '\n');

      initializeApp({ credential: cert({ projectId: pid, clientEmail: ce, privateKey: processedKey }) });
      firebaseReady = true;
    } catch (e) {
      console.error('Firebase Admin init failed:', e);
    }
  }
} else {
  firebaseReady = true;
}

function getDb() {
  if (!firebaseReady) throw new Error('Firebase Admin not initialised');
  return getFirestore();
}

// ── Types ──────────────────────────────────────────────────────────
interface TreeFile {
  path: string;
  size: number;
}

interface FileContent {
  path: string;
  content: string;
}

interface DocumentationResult {
  type: string;
  title: string;
  content: string;
  repoFullName: string;
  metadata: {
    generatedAt: string;
    model: string;
    tokensUsed?: number;
    filesAnalyzed: number;
  };
}

// ── Helper: fetch repo tree from GitHub ────────────────────────────
async function getRepoTree(octokit: Octokit, owner: string, repo: string): Promise<TreeFile[]> {
  const { data } = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: 'HEAD',
    recursive: 'true',
  });

  const codeExtensions = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs', '.rb',
    '.cpp', '.c', '.h', '.cs', '.swift', '.kt', '.vue', '.svelte',
    '.json', '.yaml', '.yml', '.toml', '.md', '.css', '.scss', '.html',
  ]);

  return (data.tree || [])
    .filter((item): item is typeof item & { path: string; size: number } =>
      item.type === 'blob' &&
      !!item.path &&
      !item.path.includes('node_modules') &&
      !item.path.includes('.lock') &&
      !item.path.includes('dist/') &&
      !item.path.includes('build/') &&
      !item.path.includes('.min.') &&
      !item.path.startsWith('.') &&
      codeExtensions.has('.' + (item.path.split('.').pop() || ''))
    )
    .map((item) => ({ path: item.path, size: item.size ?? 0 }));
}

// ── Helper: fetch file contents (batched) ──────────────────────────
async function getFileContents(
  octokit: Octokit,
  owner: string,
  repo: string,
  files: TreeFile[],
  maxFiles = 25,
): Promise<FileContent[]> {
  // Prioritise important files
  const priority = ['README', 'package.json', 'index', 'main', 'app', 'server', 'config'];
  const sorted = [...files].sort((a, b) => {
    const aScore = priority.findIndex((p) => a.path.toLowerCase().includes(p.toLowerCase()));
    const bScore = priority.findIndex((p) => b.path.toLowerCase().includes(p.toLowerCase()));
    return (aScore === -1 ? 99 : aScore) - (bScore === -1 ? 99 : bScore);
  });

  const chosen = sorted.slice(0, maxFiles);

  const results: FileContent[] = [];
  // Fetch in parallel batches of 10
  for (let i = 0; i < chosen.length; i += 10) {
    const batch = chosen.slice(i, i + 10);
    const fetched = await Promise.allSettled(
      batch.map(async (f) => {
        const { data } = await octokit.repos.getContent({ owner, repo, path: f.path });
        if ('content' in data && data.encoding === 'base64') {
          return { path: f.path, content: Buffer.from(data.content, 'base64').toString('utf-8') };
        }
        return null;
      }),
    );
    for (const r of fetched) {
      if (r.status === 'fulfilled' && r.value) results.push(r.value);
    }
  }
  return results;
}

// ── Documentation generators ───────────────────────────────────────

function buildArchitectureDoc(repoName: string, tree: TreeFile[], files: FileContent[]): string {
  const langMap: Record<string, number> = {};
  tree.forEach((f) => {
    const ext = f.path.split('.').pop() || 'other';
    langMap[ext] = (langMap[ext] || 0) + 1;
  });

  const topDirs = [...new Set(tree.map((f) => f.path.split('/')[0]))].slice(0, 20);

  // Detect frameworks from package.json if available
  const pkgFile = files.find((f) => f.path === 'package.json' || f.path.endsWith('/package.json'));
  let dependencies = '';
  if (pkgFile) {
    try {
      const pkg = JSON.parse(pkgFile.content);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      dependencies = Object.keys(deps).slice(0, 30).join(', ');
    } catch { /* ignore */ }
  }

  // Detect README
  const readme = files.find((f) => f.path.toLowerCase().includes('readme'));

  return `# ${repoName} — Architecture Overview

## Project Statistics
| Metric | Value |
|--------|-------|
| Total Files | ${tree.length} |
| Total Size | ${(tree.reduce((s, f) => s + f.size, 0) / 1024).toFixed(1)} KB |

## Technology Stack
${Object.entries(langMap)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .map(([ext, count]) => `- **.${ext}** — ${count} file${count > 1 ? 's' : ''}`)
  .join('\n')}

${dependencies ? `## Key Dependencies\n${dependencies}\n` : ''}

## Directory Structure
\`\`\`
${topDirs.map((d) => `${d}/`).join('\n')}
\`\`\`

## Key Components
${tree
  .filter((f) => !f.path.includes('/') || f.path.split('/').length <= 2)
  .slice(0, 20)
  .map((f) => `- \`${f.path}\``)
  .join('\n')}

${readme ? `## README Excerpt\n${readme.content.slice(0, 1500)}\n` : ''}

---
*Generated by DocuGenAI*
`;
}

function buildOnboardingDoc(repoName: string, tree: TreeFile[], files: FileContent[]): string {
  const pkgFile = files.find((f) => f.path === 'package.json');
  let scripts = '';
  let deps = '';
  if (pkgFile) {
    try {
      const pkg = JSON.parse(pkgFile.content);
      if (pkg.scripts) {
        scripts = Object.entries(pkg.scripts)
          .map(([k, v]) => `- \`npm run ${k}\` — ${v}`)
          .join('\n');
      }
      deps = Object.keys(pkg.dependencies || {}).slice(0, 15).join(', ');
    } catch { /* ignore */ }
  }

  const readme = files.find((f) => f.path.toLowerCase().includes('readme'));
  const languages = [...new Set(tree.map((f) => f.path.split('.').pop()))].slice(0, 8);

  return `# ${repoName} — Developer Onboarding Guide

## Welcome!
Welcome to **${repoName}**! This guide will help you get started quickly.

## Prerequisites
- **Languages**: ${languages.join(', ')}
${deps ? `- **Key packages**: ${deps}` : ''}
- Git installed locally
- A code editor (VS Code recommended)

## Getting Started

### 1. Clone the repository
\`\`\`bash
git clone https://github.com/${repoName}.git
cd ${repoName.split('/')[1] || repoName}
\`\`\`

### 2. Install dependencies
\`\`\`bash
npm install
\`\`\`

${scripts ? `### 3. Available Scripts\n${scripts}\n` : ''}

## Project Structure
The project contains **${tree.length}** files organised as follows:
\`\`\`
${[...new Set(tree.map((f) => f.path.split('/').slice(0, 2).join('/')))]
  .slice(0, 20)
  .join('\n')}
\`\`\`

## Key Files to Explore
${tree
  .filter((f) => {
    const name = f.path.toLowerCase();
    return name.includes('readme') || name.includes('index') || name.includes('main') || name.includes('app') || name === 'package.json';
  })
  .slice(0, 10)
  .map((f) => `- \`${f.path}\``)
  .join('\n')}

${readme ? `## From the README\n${readme.content.slice(0, 1000)}\n` : ''}

## Making Your First Contribution
1. Create a feature branch: \`git checkout -b feature/my-change\`
2. Make your changes
3. Run tests (if available)
4. Submit a pull request

---
*Generated by DocuGenAI*
`;
}

function buildAPIDoc(repoName: string, tree: TreeFile[], files: FileContent[]): string {
  // Find API-related files
  const apiFiles = files.filter((f) => {
    const p = f.path.toLowerCase();
    return p.includes('api') || p.includes('route') || p.includes('controller') || p.includes('handler') || p.includes('endpoint');
  });

  // Find exports / functions from files
  const exportSummaries: string[] = [];
  files.forEach((f) => {
    const exports = f.content.match(/export\s+(default\s+)?(function|const|class|interface|type)\s+(\w+)/g);
    if (exports && exports.length > 0) {
      exportSummaries.push(`### \`${f.path}\`\n${exports.slice(0, 10).map((e) => `- \`${e.trim()}\``).join('\n')}`);
    }
  });

  return `# ${repoName} — API Documentation

## Overview
This document catalogues the public API surface of the **${repoName}** codebase.

## API Files Found
${apiFiles.length > 0
    ? apiFiles.map((f) => `- \`${f.path}\``).join('\n')
    : '*No explicit API route files detected*'}

## Exports by File
${exportSummaries.length > 0 ? exportSummaries.slice(0, 15).join('\n\n') : '*Run with AI enabled (GEMINI_API_KEY) for detailed export analysis*'}

## File Reference
${tree
  .filter((f) => f.path.endsWith('.ts') || f.path.endsWith('.js') || f.path.endsWith('.tsx') || f.path.endsWith('.jsx'))
  .slice(0, 30)
  .map((f) => `- \`${f.path}\` (${(f.size / 1024).toFixed(1)} KB)`)
  .join('\n')}

---
*Generated by DocuGenAI*
`;
}

function buildFullDoc(repoName: string, tree: TreeFile[], files: FileContent[]): string {
  return [
    buildArchitectureDoc(repoName, tree, files),
    '\n---\n',
    buildOnboardingDoc(repoName, tree, files),
    '\n---\n',
    buildAPIDoc(repoName, tree, files),
  ].join('\n');
}

// ── Gemini AI generation (if available) ────────────────────────────
async function generateWithGemini(
  repoName: string,
  docType: string,
  tree: TreeFile[],
  files: FileContent[],
): Promise<{ content: string; tokensUsed?: number } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // Build a concise context from the repo
    const fileSummary = tree
      .slice(0, 40)
      .map((f) => f.path)
      .join('\n');

    const fileContents = files
      .slice(0, 10)
      .map((f) => `=== ${f.path} ===\n${f.content.slice(0, 2000)}`)
      .join('\n\n');

    const prompts: Record<string, string> = {
      architecture: `You are a senior software architect. Analyse this repository and generate a comprehensive Architecture Overview document in markdown.

Repository: ${repoName}
Total files: ${tree.length}

File tree:
${fileSummary}

Key file contents:
${fileContents}

Generate markdown documentation covering:
1. **Project Overview** – purpose and goals
2. **Technology Stack** – languages, frameworks, tools
3. **Architecture Patterns** – design patterns, data flow
4. **Directory Structure** – explain the organization  
5. **Key Components** – main modules and their responsibilities
6. **Data Flow** – how data moves through the system
7. **Getting Started** – high-level setup steps`,

      onboarding: `You are a helpful developer advocate. Create a comprehensive Developer Onboarding Guide for new team members joining this project.

Repository: ${repoName}
Total files: ${tree.length}

File tree:
${fileSummary}

Key file contents:
${fileContents}

Generate a welcoming markdown guide covering:
1. **Welcome** – brief project introduction
2. **Prerequisites** – required tools and knowledge
3. **Setup Steps** – step-by-step local setup
4. **Project Structure** – explain folders and files
5. **Development Workflow** – how to develop/test
6. **First Contribution** – guide to first PR
7. **Key Resources** – important files to read`,

      api: `You are a technical writer. Generate detailed API documentation for this codebase.

Repository: ${repoName}

File tree:
${fileSummary}

Key file contents:
${fileContents}

Generate markdown API documentation covering:
1. **API Overview**
2. **Endpoints / Exports** – document public APIs
3. **Data Types** – key interfaces and types
4. **Usage Examples** – show how to use key functions
5. **Error Handling** – common errors`,

      'full-analysis': `You are a senior software engineer. Generate comprehensive documentation for this entire codebase.

Repository: ${repoName}
Total files: ${tree.length}

File tree:
${fileSummary}

Key file contents:
${fileContents}

Generate comprehensive markdown documentation covering:
1. **Architecture Overview** – system design and patterns
2. **Technology Stack** – all technologies used
3. **Getting Started** – setup and development guide
4. **Project Structure** – detailed folder explanation
5. **API Reference** – key exports and functions
6. **Data Flow** – how components interact
7. **Contributing Guide** – how to contribute`,
    };

    const prompt = prompts[docType] || prompts['full-analysis'];
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return {
      content: text,
      tokensUsed: response.usageMetadata?.totalTokenCount,
    };
  } catch (error) {
    console.error('Gemini generation failed:', error);
    return null;
  }
}

// ── Main handler ───────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  };

  try {
    if (!firebaseReady) {
      return NextResponse.json({ error: 'Firebase not initialised' }, { status: 500, headers });
    }

    const { repoFullName, documentationType, jobId } = await request.json();

    if (!repoFullName) {
      return NextResponse.json({ error: 'repoFullName is required' }, { status: 400, headers });
    }

    const [owner, repo] = repoFullName.split('/');
    if (!owner || !repo) {
      return NextResponse.json({ error: 'Invalid repoFullName format' }, { status: 400, headers });
    }

    const docType = documentationType || 'full-analysis';
    console.log(`📚 Generating ${docType} docs for ${repoFullName}`);

    const db = getDb();

    // ── 1. Get GitHub token ──────────────────────────────────────
    const githubToken = process.env.GITHUB_TOKEN || process.env.GITHUB_APP_INSTALLATION_TOKEN;
    if (!githubToken) {
      return NextResponse.json({ error: 'No GitHub token configured' }, { status: 500, headers });
    }

    const octokit = new Octokit({ auth: githubToken });

    // ── 2. Fetch repository tree ─────────────────────────────────
    console.log('🌳 Fetching repo tree...');
    const tree = await getRepoTree(octokit, owner, repo);
    console.log(`📁 Found ${tree.length} files`);

    // ── 3. Fetch key file contents ───────────────────────────────
    console.log('📄 Fetching file contents...');
    const files = await getFileContents(octokit, owner, repo, tree, 20);
    console.log(`📖 Fetched ${files.length} files`);

    // ── 4. Generate documentation ────────────────────────────────
    let content: string;
    let model = 'template';
    let tokensUsed: number | undefined;

    // Try Gemini first
    const aiResult = await generateWithGemini(repoFullName, docType, tree, files);
    if (aiResult) {
      content = aiResult.content;
      model = 'gemini-2.0-flash';
      tokensUsed = aiResult.tokensUsed;
      console.log('🤖 Generated with Gemini AI');
    } else {
      // Fallback to template-based generation
      console.log('📝 Using template-based generation');
      switch (docType) {
        case 'architecture':
          content = buildArchitectureDoc(repoFullName, tree, files);
          break;
        case 'onboarding':
          content = buildOnboardingDoc(repoFullName, tree, files);
          break;
        case 'api':
          content = buildAPIDoc(repoFullName, tree, files);
          break;
        default:
          content = buildFullDoc(repoFullName, tree, files);
      }
    }

    // ── 5. Save to Firestore jobResults ──────────────────────────
    const docTypeLabels: Record<string, string> = {
      architecture: 'Architecture Overview',
      onboarding: 'Developer Onboarding Guide',
      api: 'API Documentation',
      'full-analysis': 'Complete Documentation',
    };

    const result: DocumentationResult = {
      type: docType,
      title: `${repoFullName} — ${docTypeLabels[docType] || 'Documentation'}`,
      content,
      repoFullName,
      metadata: {
        generatedAt: new Date().toISOString(),
        model,
        tokensUsed: tokensUsed ?? null,
        filesAnalyzed: files.length,
      },
    };

    const jobResultData = {
      jobId: jobId || null,
      repoId: repoFullName,
      repoFullName,
      status: 'completed',
      analysis: {
        type: docType,
        filesAnalyzed: files.length,
        documentation: result,
      },
      createdAt: new Date(),
      completedAt: new Date(),
    };

    const docRef = await db.collection('jobResults').add(jobResultData);
    console.log('✅ Documentation saved:', docRef.id);

    // ── 6. Update job status if jobId provided ───────────────────
    if (jobId) {
      try {
        await db.collection('jobs').doc(jobId).update({
          status: 'completed',
          updatedAt: new Date(),
          completedAt: new Date(),
          resultId: docRef.id,
        });
      } catch (e) {
        console.warn('Could not update job status:', e);
      }
    }

    return NextResponse.json(
      {
        success: true,
        resultId: docRef.id,
        documentationType: docType,
        model,
        filesAnalyzed: files.length,
      },
      { headers },
    );
  } catch (error) {
    console.error('❌ Documentation generation failed:', error);
    return NextResponse.json(
      {
        error: 'Documentation generation failed',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500, headers },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    },
  });
}
