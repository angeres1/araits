# PRD Quality Review — Mini ERP (WMS + CRM Light) para Dropshipping

## Overall verdict

This PRD holds up well: it has a real thesis (guide-traceability loss + no early churn signal, both backed by fresh competitive research), FRs with mostly testable consequences, and an unusually honest treatment of open tensions ([ASSUMPTION], [NOTE FOR PM], 12 genuinely open questions). It is not broken and is fit to go back to the partners for review as planned. The material risks are narrower: one FR references the wrong Success Metric (§4.3 FR-4 cites SM-1 when SM-2 is the one that matches), two FRs assert a system behavior without saying how it's determined (guide-type detection in FR-4, restock-eligible causes in FR-5), and there's no NFR at all for security/access control despite the product holding commercial partner data.

## Decision-readiness — strong

Trade-offs are named with what's given up, not smoothed over. §4.5's `[NOTE FOR PM]` on FR-6 explicitly flags that the manual-assignment design could change if the two unnamed carriers turn out to be worth a point integration — a real fork, not a safe checkpoint. §5.3 does the same for the transportadora-API decision. §8 openly states "sin métrica cuantitativa de negocio todavía definida" instead of padding with a soft synthetic metric. The 12 Open Questions in §9 are genuinely unresolved — none read as rhetorical with the answer already given nearby (e.g., OQ4 "cuáles son exactamente las dos transportadoras" is a real blocker for FR-6's design, not a decorative question).

No findings — this dimension is doing its job.

## Substance over theater — strong

- **Vision (§1)** is specific to this product's origin (a partner's own pilot client, the "guía reemplazatoria" failure mode) and is backed by a direct quote from Extensiv/Skubana's own help docs confirming the gap exists even in mature tooling (addendum, "Research de landscape competitivo") — earned, not asserted.
- **NFRs (§5.1)** are product-specific ("cero campos de texto libre salvo excepción deliberada," transactional guide-linking under unstable warehouse connectivity) rather than the generic "must be scalable/secure/reliable" boilerplate the rubric warns about.
- **Personas**: 5 named roles (Marta, Camilo, Sofía, Diego, Laura) across 6 UJs — technically above the rubric's four-persona theater threshold, but each maps to a distinct warehouse/CRM station and drives specific FRs (not decorative); this reads as genuine role differentiation, not persona padding.

No findings.

## Strategic coherence — strong

The thesis ("dos problemas que hoy nadie en el mercado resuelve bien") is stated once in §1 and every in-scope feature traces back to it: FR-1–FR-6 serve traceability, FR-7/FR-8 serve the churn-alert half. Out-of-scope items (§7.2: financial reconciliation, admin/payroll, pricing/margins, reporting) are consistently the ones that don't serve either half of the thesis. Success Metrics validate the thesis rather than activity: SM-1/SM-2 are outcome-shaped ("deja de contar físicamente," "cero pérdida de trazabilidad"), and the counter-metrics (SM-C1: fallback/manual-assignment volume shouldn't silently grow; SM-C2: alert volume shouldn't be optimized upward) show real thought about what *not* to chase — this is not a backlog-with-headings PRD.

No findings.

## Done-ness clarity — adequate

Most FRs have testable consequences (FR-1, FR-3, FR-7, FR-8 in particular are unambiguous), and thresholds that aren't yet known are honestly marked `[ASSUMPTION]` rather than hidden behind vague adjectives — I did not find "manejo gracefully"/"reasonable performance"-style filler anywhere in §4. But a few FRs assert a behavior without specifying the mechanism that makes it true:

### Findings
- **medium** FR-4 detection mechanism unspecified (§4.3 FR-4) — "El sistema distingue una Guía de Retorno de una Guía de Despacho al momento del escaneo" states the outcome but never says by what signal (guide-number format, prefix, courier field, manual toggle). The addendum's UX note resolves scan *order* but not *how the system tells the two apart*. *Fix:* add one consequence naming the distinguishing signal, or explicitly mark it `[ASSUMPTION — to define in UX/architecture]`.
- **medium** FR-5 "producto reutilizable" condition undefined (§4.4 FR-5) — "Si la causa indica producto reutilizable, el stock se actualiza automáticamente (condicional a la causa)" never states which of the 4 tipificación causes (Compra Falsa / Rechazo Cliente / Retraso Bodega / Daño Transportadora) count as reutilizable. This is core to the product's stock-accuracy value prop, not a peripheral detail. *Fix:* state the cause→restock mapping explicitly, or mark `[ASSUMPTION]` pending partner confirmation and index it in §10.
- **medium** No security/access-control NFR anywhere in §5 — the product will hold dropshipper commercial data, order history, and multi-role access (bodega staff vs. comercial), yet §5.1–§5.5 contain no line on authentication, role-based access, or data handling. For a self-funded single-pilot MVP this may genuinely be deferred, but as written it's a silent omission rather than a scoped decision. *Fix:* add one line — either a minimal NFR or an explicit `[NON-GOAL for MVP]`/`[NOTE FOR PM]` deferring it.
- **low** SM-3 has an unmeasurable qualifier (§8) — "en uso activo diario y sostenido por el equipo operativo, sin resistencia ni quejas" is subjective; "sin quejas" can't be verified. *Fix:* swap for an observable proxy (e.g., % of transactions logged through the app vs. WhatsApp/Excel after week N).
- **low** §5.1 NFR-01 is unbound — "debe operar de forma fluida... sin fricción adicional de configuración" has no measurable threshold (scan-to-confirm latency, zero-config steps count). *Fix:* add a number or mark as a design target pending pilot validation.

## Scope honesty — strong

§6 (No-Objetivos) and §7.2 (Fuera de Alcance) do real work — each exclusion is tied to a reason and, where relevant, an Open Question cross-reference (e.g., pricing/margins → OQ6, slotting/catalog → OQ7, admin/payroll → OQ8). De-scoping is proposed honestly rather than silently: the transportadora-API exclusion (§5.3) explains *why* (FR-4/FR-6 operate on scan/manual entry) and flags the possible future reversal via `[NOTE FOR PM]`. Given this PRD is headed back to partners for review rather than straight to build, the volume of Open Questions (12) and `[ASSUMPTION]` tags is proportionate to the stakes, not a red flag.

One roundtrip gap noted under Mechanical notes below (two inline `[ASSUMPTION]` tags not indexed in §10).

## Downstream usability — adequate

This is a chain-top PRD (addendum: "el equipo técnico lo necesitará en el siguiente paso (`bmad-ux`, `bmad-architecture`)"), so traceability matters more here than for a standalone document. UJ→FR mapping is clean and complete (every UJ's "*(Realiza FR-…)*" tag matches its feature section), IDs are contiguous (FR-1…FR-8, UJ-1…UJ-6, SM-1…SM-3/SM-C1-2), and the Glossary is used consistently for the domain-critical terms (Guía de Despacho/Retorno/Reemplazatoria, Dropshipper, Tipificación).

### Findings
- **high** Wrong Success Metric cross-reference in FR-4 (§4.3) — "Cero pérdida de trazabilidad para devoluciones procesadas por este flujo (ver SM-1)." SM-1 (§8) is "la bodega deja de contar físicamente el inventario... Valida FR-1, FR-2, FR-3" — it has nothing to do with traceability. The metric that actually matches this sentence, word-for-word, is SM-2: "Cero pérdidas de trazabilidad entre guía de despacho y guía de retorno... Valida FR-4, FR-6." This is the flagship feature of the PRD (§1's Vision opens on exactly this problem), so a reader tracing FR-4 to its success criterion lands on the wrong one. *Fix:* change "(ver SM-1)" to "(ver SM-2)" in §4.3 FR-4.

## Shape fit — strong

The product is a multi-role operational tool (5 distinct warehouse/CRM stations, each with a touch-first workflow) plus a light B2B alert function — UJs with named protagonists are load-bearing here, not overhead, since each role genuinely needs its own walkthrough to be buildable. The PRD correctly resists over-formalizing: no UJs were invented for the excluded admin/finance/reporting scope, and the capability-spec framing (FR grouped under 6 features) stays proportionate to an 8-FR MVP. The brownfield-adjacent lineage (existing HU-01–HU-05 + `evidencias.docx` RF/RNF IDs vs. new capabilities from Hugo's feedback) is explicitly distinguished in the addendum's ID-mapping table rather than blurred.

No findings.

## Mechanical notes

- **Assumptions Index roundtrip gap** — two inline `[ASSUMPTION]` tags are not indexed in §10: (1) §5.1 "la operación de vincular... deben ser transaccionales... `[ASSUMPTION]` no confirmado explícitamente por los socios," and (2) §5.4 "`[ASSUMPTION]` dispositivo host de bodega: tablet o smartphone Android — no confirmado explícitamente." Every other inline `[ASSUMPTION]` in the document round-trips correctly to §10. *Fix:* add both to the Índice de Supuestos.
- **Cross-reference note** — see the FR-4/SM-1↔SM-2 finding under Downstream usability above; flagging again here since it's an ID-continuity defect, not just a content gap.
- **Glossary case drift (minor, cosmetic)** — "Dropshipper" is capitalized as a defined term in §3, §4.6, §8, but appears lowercase in flowing prose in §2.1 and §2.3 UJ-6 ("un dropshipper cayó de 200 a 20..."). Consistent with normal proper-noun-in-header vs. common-noun-in-prose style; not worth a fix unless the team wants strict term consistency for downstream parsing.
- No duplicate or gapped FR/UJ/SM IDs found. No broken `(ver §…)` section cross-references found other than the SM-1/SM-2 case above.

---

**Summary:** 1 high, 3 medium, 2 low findings in the dimension sections, plus 1 mechanical (Assumptions Index gap, 2 unindexed tags) and 1 duplicate mention (cross-ref) in Mechanical notes.
