## 1. Tech Stack and Infra Conventions

- **Runtime:** Node.js (LTS), TypeScript across all services.
- **Frontend:** Next.js (App Router).
- **Backend / Jobs:** Firebase Cloud Functions (HTTP + background).
- **Auth:** Firebase Auth with GitHub provider.
 **Repository Access**: GitHub Apps for secure and scalable repository interaction.
- **Primary Data Store:** Firestore (or Firebase-backed data layer).
- **AI/LLM Provider**: Google Gemini Flash for document generation.
- **Vector Store:** pgvector or external vector DB via a small adapter layer.
- **Package Manager:** pnpm with workspaces.

All shared tooling versions (TypeScript, ESLint, Prettier) are defined at the repo root to avoid version mismatches.
Individual function projects should align with the root toolchain versions.
