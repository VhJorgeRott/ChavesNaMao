# brand/ — cópias de preview

⚠️ **Estes PNGs são apenas para preview da doc.** Não são a fonte de verdade e **não** devem ser importados no código.

A fonte de verdade de cada logo fica em `public/` / `src/assets/`. Para usar um logo no app, importe pelo caminho de origem — veja a tabela completa, tamanhos e regras de uso em [../marca.md](../marca.md).

| Arquivo (preview) | Origem (usar no código) |
|---|---|
| `rottas-simbolo-laranja.png` | [public/Brand/rottas_logo_laranja.png](../../../public/Brand/rottas_logo_laranja.png) |
| `rottas-simbolo-login.png` | [src/assets/logo-rottas-login.avif](../../../src/assets/logo-rottas-login.avif) |
| `rottas-lockup-horizontal.png` | [src/assets/logo-rottas-gray.avif](../../../src/assets/logo-rottas-gray.avif) |
| `rottas-favicon.png` | [public/favicon2.ico](../../../public/favicon2.ico) |

## Como regerar um preview

Os AVIF/ICO foram convertidos para PNG com `sips` (nativo do macOS):

```bash
sips -s format png src/assets/logo-rottas-login.avif --out docs/design-system/brand/rottas-simbolo-login.png
```

Ao adicionar uma variação nova, gere o PNG aqui e atualize a tabela de Arquivos em [../marca.md](../marca.md).
