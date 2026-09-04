# AGENTS.md

## Project overview

This repository is a single-page marketing and demo website for Fila Zero Saúde, a healthcare queue assistance concept for Uberlândia, Minas Gerais.

- Main file: [index.html](index.html)
- Stack: plain HTML + Tailwind CSS via CDN + embedded JavaScript
- Purpose: landing page + interactive chatbot demo + WhatsApp escalation flow

## Working conventions

- Keep the project as a static website unless the user explicitly asks for a framework or backend.
- Prefer small, targeted edits to [index.html](index.html); this repo has no build pipeline or package manager.
- Maintain the site copy in Brazilian Portuguese and keep the tone empathetic, professional, and healthcare-safe.
- Preserve the existing structure and sections: hero, problem/solution, workflow, demo, ethics/privacy, footer, and floating chat widget.
- When changing UI, prefer Tailwind utility classes already in use and avoid introducing new frameworks or build tooling.
- Be careful with medical messaging. The site must not imply diagnosis, treatment, or emergency triage beyond a clear safety disclaimer.

## Important implementation notes

- The chat widget uses a browser-side Groq API call and a simulated fallback flow.
- Do not commit real API keys or secrets directly into client-side code. If credentials are needed later, move them behind a server or environment configuration.
- The WhatsApp CTA is a key conversion path; keep the redirect logic intact when adjusting the chatbot behavior.
- The site is intended for static preview in a browser, not for a production app deployment unless explicitly requested.

## Validation

To preview locally:

- Open [index.html](index.html) directly in a browser, or
- Run a simple static server from the repo root, for example:

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

## Guidance for AI agents

- Prefer minimal, local edits over broad refactors.
- If the user requests feature work, first inspect the existing HTML sections and match the existing design language instead of introducing a new structure.
- Keep behavior changes aligned with the product goal: reduce uncertainty, improve communication, and route complex cases to a human operator.
