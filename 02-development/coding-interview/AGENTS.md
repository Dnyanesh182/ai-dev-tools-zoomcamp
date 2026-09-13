# Agent instructions

- Keep the OpenAPI contract in `openapi.yaml` aligned with backend routes.
- Run `npm test` after backend changes and `npm run build` after frontend changes.
- Do not execute candidate code on the server; browser execution uses Pyodide.
- Use conventional commits and do not commit generated databases or node modules.
