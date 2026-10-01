# AI Output Bench: design specification

Accepted implementation reference: private generated workspace concept (not shipped), generated with built-in Image Gen on 2026-10-01; inspected before application source edits. The concept represents the entire primary workspace, not a landing page. No raster asset is used in the running interface; the interface and bracket mark are code-native.

## Visual system
- True white background and surfaces, ink #20211f, neutral chrome #f6f6f4, borders #deded8; vivid orange #f15c22 primary controls. No gradients, illustrations, external fonts, or analytics.
- System sans for controls/content; system monospace for JSON and error pointers. Heading 32px/1.2, body 16px/1.5, field/control/diagnostic/code text 14px, compact metadata 12px/1.5. Orange brackets are a simple code-native mark.
- 32px desktop gutter; content max-width 1500px. A slim 64px header, editorial title row, horizontal template strip, three aligned editor/result panels, then fixture table. Panels use thin borders and 6px corners. No nested dashboard cards except semantic diagnostic/status boxes.
- Primary editor proportions: schema 40%, output 33%, results 27%. Aligned panel headers, 540px desktop editor workspace (600px on large screens). Repeated controls use the same border, height, and focus ring.
- All primary interactive targets at least 40px, 44px on mobile. Visible 3px keyboard focus ring. Semantic green success and orange/red diagnostic states always include explicit words.

## Content and state
Title: “Test the shape of your AI output.” Helper: “Validate JSON against a schema. Keep the cases that matter.” Brand: “AI Output Bench”. Actions: Import pack, Export pack, Run all tests, Add fixture. Templates: Product extraction, Support triage, Empty workspace. The fixture result explicitly separates output validity from expectation pass/fail. No fake AI scoring or model calls.

Export/import uses a native dialog with a selectable full JSON text preview, copy action, and optional download. Import is explicit and atomic; a failed import preserves current work. Switching templates and import prompts make replacement explicit. Editing inputs invalidates old results. Cancel and timeout are indeterminate.

## Responsive and accessibility
Below 1050px, results spans the editor row; below 680px, all panels stack, fields wrap, and fixture table becomes labeled rows without horizontal viewport overflow. 320px and 390px CSS widths are first-class. Keyboard runs via Ctrl/Cmd+Enter, modal uses native focus management, Escape closes, buttons have textual accessible labels. Motion is absent except small color transitions and obeys reduced-motion preferences. English/Chinese and light/dark/system apply consistently; only these display preferences may persist.

## Disclosures
Draft 2020-12. Formats are annotations, not validation rules. Processing runs in a bounded browser Worker. Pasted schema/fixture text remains only in current page memory unless explicitly exported. Browser-number semantics and limits remain visible in the help disclosure.

## Readability correction
Regular editable code, diagnostic text, fields, and controls use at least 14px text; body content uses 16px, secondary metadata at least 12px. Code and virtual gutter share an exact 24px line height to prevent long-document subpixel drift. Where these sizes need room, the interface wraps or grows vertically rather than shrinking text.
