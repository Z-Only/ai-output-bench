# Verification

## Automated checks

2026-10-01: 94 tests passed. Production build and strict TypeScript checks passed. Coverage: statements 99.79%, branches 99.48%, functions 100%, lines 100%. Tests include schema correctness, fixture expectations, JSON safety, pack validation, bounded execution, stale response suppression, display preferences, modal focus restoration, and editor gutter scrolling beyond 1,000 lines. Only locale and theme are written to browser storage.

## Live-browser checks

The public deployment was checked in Chromium on 2026-10-01:

- The browser Web Worker successfully compiled and ran the default schema under the deployed content-security policy. All four default fixture expectations matched. A negative fixture displayed both `Output is Invalid` and `Expected Invalid`, plus the exact `#/required` schema pointer.
- A deliberately pathological regular expression reached the 2,000 ms timeout and produced an indeterminate result. A subsequent ordinary run succeeded. Cancel stopped a run. Editing during a run cleared old results; delayed responses did not replace the stale-input notice.
- Export exposed the complete selectable JSON pack. Copy was verified byte-for-byte against that preview. Invalid import displayed a validation error, and a valid export/import round trip preserved the pack and ran successfully.
- Dialog confirmation, close, and Escape returned keyboard focus to the opener. Automated tests also cover a deleted or disabled opener, with fallback to the schema editor.
- Light English and dark Chinese interfaces were inspected. At measured `innerWidth` values of 390 and 320 CSS pixels, there was no horizontal page overflow and no out-of-bounds button, select, input, or panel. The narrow fixture layout and export dialog remained usable.

The narrow checks used an ordinarily resized desktop browser at 200% zoom. They are responsive CSS checks, not physical-phone or touch-device certification. Full-page screenshots in that zoomed environment were cropped incorrectly, so native browser-window captures were used for visual inspection.

## Visual comparison

The implementation was compared against the full-workspace design concept:

1. It preserves the white-and-ink technical surface, orange primary actions, gray panel headers, and small-radius borders.
2. It preserves the slim brand header, title/action row, template strip, schema/output/results arrangement, and lower fixture table.
3. System sans and monospace typography retain distinct content, control, and code hierarchies without external font requests.
4. Success and diagnostic panels remain semantic and explicit; actual validity and expectation verdict are separate.
5. Narrow layouts stack the panels and expose fixture labels rather than shrinking a desktop table. Dark mode preserves hierarchy and contrast.

Live inspection found an editor gutter that did not follow textarea scrolling and an emoji-rendered play glyph. The current correction uses a bounded, scrolling line-number window and code-native SVG icons, with an exact shared 24px line height and a regression test beyond 1,000 lines; it also aligns narrow fixture verdict labels and increases regular code, diagnostic, field, and control text to at least 14px (secondary metadata at least 12px). The deployed corrections were rechecked at 320 and 390 CSS pixels. On a 1,204-line schema, textarea scrollTop 28,577 produced first gutter line 1,191, exactly matching the shared 24px line-height calculation. The live code font was 14px and metadata 12px. The SVG icons and fixture-label alignment were also visually verified. A final narrow-dialog correction stacks export actions in DOM order at 390px and below, with full-width, no-wrap, 44px targets; its CSSOM constraints pass automated tests and its deployment recheck is pending.

## Known verification limits

The download control reported “Download requested,” but this browser did not expose a completed download event or file. Download completion remains unverified. The selectable JSON preview and verified copy action are the tested export paths. No model API compatibility or generated-output quality claim is made.
