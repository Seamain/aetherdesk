## Summary
<!-- What changed and why -->

## Checklist
- [ ] `pnpm --filter client build` passes
- [ ] `pnpm test` passes (new APIs have smoke/auth cases)
- [ ] curl checks for touched endpoints (incl. auth 401/200 when relevant)
- [ ] i18n: zh / hant / yue / en key counts match
- [ ] README API table updated if endpoints changed
- [ ] No `data/`, `node_modules/`, `dist/`, or secrets in the diff

## Notes
<!-- Screenshots / follow-ups -->
