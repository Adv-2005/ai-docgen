# AI Documentation Generator – Architecture

_Last updated: 2025-12-18_

## 1. High-level Overview

The system automatically generates and maintains technical documentation for codebases by:

- Ingesting repositories (initially GitHub).
- Analyzing code structure, git history, and pull requests.
- Using LLMs and embeddings to produce semantic, developer-friendly docs:
  - Onboarding guides
  - Architecture overviews
  - API/module-level documentation
  - Change explanations for PRs and merges
- Tracking usage and impact (onboarding time reduction, documentation coverage, and estimated cost savings).

The project is organized as a **monorepo** with three main parts:

- `functions-api/` – Firebase Cloud Functions (HTTP):
  - Public API endpoints used by the frontend.
  - GitHub webhook handlers for PRs, pushes, and merges.
- `functions-worker/` – Firebase background/serverless jobs:
  - Listens to Pub/Sub topics or Firestore job documents.
  - Performs heavy work (repo analysis, doc generation, metrics aggregation).
- `frontend/` – Next.js dashboard and documentation browser.

## 2. Platform and Infrastructure

The system is built on top of the Firebase and serverless ecosystem:

- **Firebase Auth**  
  - Handles user authentication.
  - GitHub sign-in is used to connect user accounts to repositories.

- **Firestore (or Firebase-backed data layer)**  
  - Stores:
    - Users and their repository connections.
    - Documentation artifacts and versions.
    - Job metadata and status.
    - Metrics related to usage and business impact.

- **Cloud Functions (Firebase Functions)**  
  - **HTTP functions** in `functions-api`:
    - Frontend API (fetch docs, coverage, metrics).
    - GitHub webhook endpoints (PR events, pushes, merges).
  - **Background functions** in `functions-worker`:
    - Triggered by Pub/Sub topics or Firestore `jobs` collection.
    - Execute long-running operations such as cloning repositories, running code analysis, generating docs, and updating metrics.

- **Vector Store**  
  - Stores embeddings of code and documentation for semantic search.
  - Can be implemented using:
    - pgvector on a managed Postgres instance, or
    - an external vector DB (e.g., Qdrant, Pinecone).
  - Accessed from both `functions-api` and `functions-worker` via a shared adapter.

- **CI/CD**  
  - GitHub Actions (or similar) are used to:
    - Run tests and checks on every push.
    - Deploy Firebase Functions and related config on merge to the main branch.
    - Optionally trigger documentation refresh workflows as part of CI/CD.

## 3. Core Modules and Responsibilities

### 3.1 API Layer (`functions-api/src/modules`)

- **auth**  
  - Integrates Firebase Auth and GitHub provider.
  - Exposes endpoints for frontend auth flows where necessary.

- **repos**  
  - Manages repository records (linked GitHub repos, access tokens or app installations).
  - Provides endpoints for listing and configuring connected repositories.

- **webhooks** (part of `repos` or its own module)  
  - Hosts GitHub webhook handlers:
    - PR opened / updated / closed.
    - Push events.
    - Merge events to the main branch.
  - Converts incoming events into job requests (e.g., Firestore `jobs` documents or Pub/Sub messages).

- **docs**  
  - Read side: fetches documentation artifacts for the frontend.
  - Organizes docs into types (onboarding, architecture, API, change summaries).

- **metrics**  
  - Exposes endpoints for retrieving:
    - Documentation coverage metrics.
    - Estimated time saved.
    - Estimated cost savings.
  - Aggregates data from Firestore and/or vector store stats.

- **jobs**  
  - Provides small HTTP endpoints to trigger jobs manually (for testing or admin operations).
  - Encapsulates logic for writing job entries that the worker layer will process.

### 3.2 Worker Layer (`functions-worker/src`)

The worker layer is responsible for **heavy, asynchronous processing** and is triggered by:

- **Pub/Sub topics** (e.g., `repo-analysis`, `doc-generation`, `metrics-update`), or
- **Firestore job documents** (e.g., writes to a `jobs` collection).

Key services:

- **ingestion.service**  
  - Clones or fetches the repository contents.
  - Reads code files and directory structure.
  - Fetches git history for relevant ranges (commits for a PR, commits since last analysis).

- **analysis.service**  
  - Parses code (using ASTs, tree-sitter, or language-specific tools).
  - Identifies semantic units: modules, services, classes, functions.
  - Calculates diffs between current and previous versions to determine **delta updates**:
    - Which files changed?
    - Which functions/classes were added/modified/removed?

- **ai.service**  
  - Encapsulates all communication with LLM providers (e.g. OpenAI, Anthropic, Groq).
  - Uses embeddings and vector search to provide semantic context for doc generation.
  - Responsible for:
    - Generating onboarding docs.
    - Generating architecture summaries.
    - Generating API/module docs.
    - Generating change summaries for PRs and merges.

- **docs.service**  
  - Persists generated documentation artifacts into Firestore.
  - Maintains version history of docs (e.g. doc version per commit or per merge).
  - Supports partial updates when only specific modules or functions change.

- **metrics.service**  
  - Updates metrics whenever:
    - New docs are generated.
    - Existing docs are updated due to code changes.
  - Stores:
    - Documentation coverage (e.g. percentage of files / modules documented).
    - Lines of code covered by docs.
    - Simulated onboarding time reduction.
    - Estimated cost savings based on predefined formulas.

### 3.3 Frontend (`frontend/`)

The frontend is a Next.js application and provides the following views:

- **Dashboard**  
  - Shows:
    - List of connected repositories.
    - High-level documentation coverage.
    - Recent activity (docs generated/updated).
    - Summary of estimated time and cost savings.

- **Repository View**  
  - For each repository:
    - Current status (ingestion/analysis progress).
    - Documentation coverage breakdown (by module/file/service).
    - List of recent PRs and their generated change summaries.

- **Documentation Browser**  
  - Allows developers to:
    - Browse documentation per module/file/service.
    - View architecture overviews and onboarding guides.
    - Search docs semantically (using vector search behind the scenes).

- **Metrics View**  
  - Visualizes:
    - Coverage trends over time.
    - Simulated onboarding time reduction.
    - Estimated cost savings.

## 4. Serverless Pipeline and Event Flow

### 4.1 Initial Repository Setup

1. User signs in via GitHub and connects a repository.
2. `functions-api` creates a repository record and enqueues an **initial ingestion job**.
3. `functions-worker` processes the job:
   - Clones the repository.
   - Runs analysis and doc generation.
   - Stores docs and metrics.

### 4.2 PR and Merge Events (Delta Updates)

1. GitHub sends a webhook (PR opened/updated/merged, or push to main) to an HTTP function in `functions-api`.
2. The webhook handler:
   - Validates the event and repository identity.
   - Creates a **delta-analysis job** with information about:
     - Changed files.
     - Relevant commits or PR number.
3. `functions-worker` consumes this job:
   - Fetches the diff (only changed files).
   - Re-runs analysis **only for affected modules/functions**.
   - Generates updated docs (e.g. change summaries, updated API docs).
   - Stores new versions of docs.
   - Updates metrics (coverage, time saved, cost saved).

This design ensures that updates are **incremental** and **efficient**, rather than reprocessing the entire repository on every change.

### 4.3 CI/CD-Driven Documentation Updates

- A CI/CD pipeline (e.g. GitHub Actions) is configured to:
  - Run tests and lint checks on each push.
  - On merge to the main branch:
    - Confirm the build passes.
    - Optionally call a “doc refresh” API endpoint or rely on the same webhook events.
  - Deploy updated Cloud Functions and related configuration when changes are made to the `functions-api`, `functions-worker`, or Firebase config.

This creates an automated loop where documentation is kept up to date as part of the regular development workflow.

## 5. Data Storage and Models (High Level)

- **Users**  
  - Identity via Firebase Auth (linked with GitHub).
  - Settings related to doc preferences and repositories.

- **Repositories**  
  - Connection info (GitHub repo, installation or token references).
  - Last analyzed commit or timestamp.
  - Status of recent jobs.

- **Jobs**  
  - Job type (`initial-ingestion`, `delta-analysis`, `doc-generation`, `metrics-update`).
  - Status (queued, in progress, completed, failed).
  - Metadata (repo, PR number, affected files).

- **Docs**  
  - Doc type (onboarding, architecture, API, change summary).
  - Target (module/file/service/PR).
  - Version info (commit hash, timestamp).
  - Content and structured metadata.

- **Metrics**  
  - Documentation coverage per repository and over time.
  - Lines of code covered.
  - Simulated onboarding time and time saved.
  - Estimated cost savings.

## 6. Non-Functional Requirements

- **Scalability**  
  - Serverless architecture scales Cloud Functions and background jobs based on load.
  - Heavy work is offloaded to `functions-worker` to keep HTTP responses fast.

- **Resilience and Error Handling**  
  - Centralized error handling within Cloud Functions.
  - Job retries and dead-letter strategies can be implemented at the job level.
  - Structured logging for observability.

- **Observability and Business Impact**  
  - Logs for key events (job creation, analysis start/end, doc generation).
  - Metrics tables/collections for coverage and impact.
  - Dashboard views to visualize these metrics for stakeholders.

> This document will be updated as modules evolve, new providers are added, or the deployment strategy changes.

## 7.Current Implementation Status- Milestone 1

**Last updated: 2025-12-10**

## Overview  
As of **2025-12-10**, the following core components of the system are fully operational in the Firebase Emulator Suite.

---

## Firebase Project Initialization

### Firebase Emulators Running Successfully
- Functions Emulator  
- Firestore Emulator  
- Pub/Sub Emulator (working even if not visible in UI)  

---

## functions-api Progress

### Implemented Features
- **`/health` HTTP Endpoint**  
  Returns system heartbeat and confirms function deployment.

- **`analyzeRepo` Pub/Sub Worker**  
  Successfully receives Pub/Sub messages.  
  Writes structured job results to Firestore.

- **End-to-End Pipeline Verified**  
  Pub/Sub message → Function triggered → Firestore write  
  All tested inside the emulator environment.

- **Error Handling**  
  Timestamp issues fixed by using `new Date()` instead of `FieldValue.serverTimestamp()`.

---

## Local Tooling Setup

- TypeScript build pipeline configured  
- ESLint v9 (Flat Config) integrated  
- `pnpm-workspace.yaml` created for monorepo structure  

---

## Testing Workflow

- Local PowerShell and Node scripts created for publishing messages to Pub/Sub emulator.  
- Verified:
  - Function execution logs  
  - Firestore data writes  

The backend now supports stable job ingestion, enabling next steps like webhook integration.

---

# Section 4 Update: Implementation Note (Milestone 1)

_Add this under Serverless Pipeline and Event Flow._

### Implementation Note (Milestone 1)

- Pub/Sub emulator does not appear in Emulator UI on Windows, but is fully functional.  
- Background worker correctly ingests Pub/Sub messages and processes job payloads.  
- Firestore receives structured documents, confirming accurate worker execution.  
- This pipeline forms the foundation for webhook-driven delta analysis.

---

# 7. Design Decisions So Far

### 1. Timestamp Handling
- Version mismatches between firebase-admin and emulator runtime caused `Timestamp.now()` and `FieldValue.serverTimestamp()` to fail.  
- Decision: use `new Date()`; Firestore auto-converts to Timestamp.  
- Benefit: maximum compatibility across emulator and cloud.

---

### 2. Pub/Sub Trigger Testing (Windows Specific Issues)
- PowerShell corrupts JSON for `curl`, causing request failures.  
- Decision: use `curl.exe`, `Invoke-RestMethod`, or Node scripts.  
- Result: reliable message publishing pipeline.

---

### 3. Emulator-Only Development for Zero Cost
- No Blaze plan or billing required at this stage.  
- Entire backend pipeline validated locally.  
- Matches production behavior while remaining free.

---

