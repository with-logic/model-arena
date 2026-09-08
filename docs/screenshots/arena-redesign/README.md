# Arena redesign screenshots

Captured from the production static export using headless Chromium.
Desktop: 1440 × 1000. Mobile: 390 × 844. These are real generated apps running in iframes.

- [Live collection](01-live-collection.png)
- [App browser](02-app-browser.png)
- [Model picker](03-model-picker.png)
- [Model directory](04-model-directory.png)
- [Code statistics](05-code-statistics.png)
- [Split comparison](06-split-comparison.png)
- [Expanded app](07-expanded-app.png)
- [Mobile collection](08-mobile-collection.png)
- [Mobile comparison](09-mobile-comparison.png)
- [Opus app with Astra thumbnail fallbacks](10-opus-collection.png)

Browser checks covered all 52 thumbnail entries, outer arrow keys versus iframe focus, split → solo → split, and preservation of a value in the running iframe through Expand and Return. Desktop solo mode loaded three live frames; mobile loaded one. The toolbar measured 46px on desktop and 44px on mobile. The active desktop app occupied 1240 × 828px in collection mode and 1440 × 954px when expanded.

Responsive checks found no horizontal page overflow at widths from 320px to 1440px, including four selected models. The app browser's search was verified above its overlay. No page errors were observed in the browser smoke run.

The bottom strip uses the selected model's preview when available, then Astra's preview, then the prompt reference image. All 52 Astra previews are included. Live frames always use the selected model.
