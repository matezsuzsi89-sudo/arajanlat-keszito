# Magyar ékezetek a PDF-ben

A PDF export Noto Sans betűtípust használ a helyes magyar ékezetek megjelenítéséhez.

**Letöltés (kötelező):** Futtasd egyszer:

```bash
npm run download-fonts
```

Ez letölti a `NotoSans-Regular.ttf`, `NotoSans-Bold.ttf` és `NotoSans-Italic.ttf` fájlokat ebbe a mappába. Ezt követően a PDF-ben megjelennek az ékezetek.

**Kézi letöltés:** Ha a script nem működik:
1. Nyisd meg: https://github.com/googlefonts/noto-fonts/tree/main/hinted/ttf/NotoSans
2. Töltsd le a három TTF fájlt
3. Másold ebbe a `public/fonts/` mappába
