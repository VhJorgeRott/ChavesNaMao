# Modais, Diálogos e Drawers

> **Padrão atual (Wave 4 mobile-responsiveness):** todo modal de conteúdo usa o **`ResponsiveModal`** —
> bottom-sheet em mobile (< 768px), Dialog centralizado em desktop. Os custom overlays antigos foram migrados.

## Quando usar cada um

| Caso | Shell | Exemplo |
|---|---|---|
| Confirmação destrutiva (sem botão X, fecha só por Cancelar/Confirmar) | `<AlertDialog>` shadcn | [DeleteReportDialog](../../src/components/reports/DeleteReportDialog.tsx), confirmações em [VersionSelectorModal](../../src/components/analise/VersionSelectorModal.tsx) |
| Qualquer outro modal (form, tabela, seletor, info, confirmação simples) | **`ResponsiveModal`** | [InviteUserModal](../../src/components/home/InviteUserModal.tsx), [EstourosModal](../../src/components/analise/EstourosModal.tsx), [AprovacaoModal](../../src/components/atualizacao/AprovacaoModal.tsx), toggle de obra em [Empreendimentos.tsx](../../src/pages/Empreendimentos.tsx) |
| Drawer lateral (ex: detalhe de insumo) | Fixed overlay + panel (não é Sheet nem ResponsiveModal) | [InsumoDetailPanel](../../src/components/analise/InsumoDetailPanel.tsx) |
| Hub central de empreendimento (Info + KPIs + Orçamentos + Ajustes) | `ResponsiveModal` com `Tabs` internas | [EmpreendimentoModal](../../src/components/empreendimentos/EmpreendimentoModal.tsx) |

**Regra**: para qualquer modal de conteúdo novo, **use `ResponsiveModal`**. Não crie `<div className="fixed inset-0 ...">` manual.

---

## Shell padrão — `ResponsiveModal` (mobile bottom-sheet + desktop Dialog)

Componente: [src/components/ui/responsive-modal.tsx](../../src/components/ui/responsive-modal.tsx).

Comportamento automático:
- **Mobile (< md):** Drawer (vaul) — slide-up bottom-sheet, drag-to-dismiss, handle no topo, `safe-pb`, `max-h-[90dvh]`.
- **Desktop (>= md):** Dialog Radix centralizado — overlay `bg-black/80`, animação fade+zoom+slide, botão X embutido.

API espelha o shadcn Dialog:

```tsx
<ResponsiveModal open={open} onOpenChange={setOpen}>
  <ResponsiveModalContent
    desktopClassName="max-w-3xl"   // aplicado só no desktop dialog
    mobileClassName="..."           // raro, aplicado só no drawer mobile
  >
    <ResponsiveModalHeader>
      <ResponsiveModalTitle>Título</ResponsiveModalTitle>
      <ResponsiveModalDescription>Subtítulo opcional</ResponsiveModalDescription>
    </ResponsiveModalHeader>
    {/* corpo */}
    <ResponsiveModalFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
      <Button onClick={save}>Salvar</Button>
    </ResponsiveModalFooter>
  </ResponsiveModalContent>
</ResponsiveModal>
```

### Regras
- **NÃO adicione X manualmente** — o wrapper já fornece (desktop) e o handle de drag (mobile).
- **NÃO crie `fixed inset-0`** — o portal é interno.
- **NÃO escute Escape manualmente** — o Drawer/Dialog já fecha em Escape.
- Largura desktop: passe via `desktopClassName="max-w-2xl"` (ou `max-w-md` / `max-w-3xl` / `!max-w-[95vw]`).
- Para modais com tabela cheia (header + body scroll + footer fixo), use `desktopClassName="... p-0 gap-0 flex flex-col"` e organize header/body/footer como divs internos com `flex-shrink-0` e `overflow-y-auto flex-1`.
- Para drawer **fullscreen** em mobile (raro — ex: side panel), passe `mobileFullScreen` no **root**: `<ResponsiveModal mobileFullScreen open={...}>`.
- Para **travar o fechamento** (fluxo obrigatório que o usuário precisa concluir antes de sair), combine: `dismissible={false}` no **root** (bloqueia drag/clique-fora no drawer mobile do vaul), `hideCloseButton`/`hideHandle` no `*Content` (esconde o X do desktop e o handle do mobile) e um `onOpenChange` que **ignora** o pedido de fechar (`if (!open) return`). Como o `open` fica controlado em `true`, Esc/clique-fora não fecham. Ex.: carrossel obrigatório de novidades em [NewReportPopup](../../src/components/reports/NewReportPopup.tsx).

### Padrão de larguras desktop (`desktopClassName`)
- `max-w-md` (448) — confirmação curta
- `max-w-lg` (512) — formulário curto (default Dialog)
- `max-w-2xl` (672) — formulário médio
- `max-w-3xl` (768) — formulário com seções múltiplas
- `max-w-5xl` (1024) — tabela média
- `!max-w-[95vw]` — tabela larga (Estouros, VersionDiff)

---

## AlertDialog (shadcn) — só para confirmações destrutivas

Igual ao Dialog, mas **sem botão X** e com semântica de alerta (não fecha em ESC/overlay click). Use para destruições:

- `AlertDialogAction` usa `buttonVariants()` default (laranja).
- `AlertDialogCancel` usa `variant="outline"` com `mt-2 sm:mt-0`.

Pode ser aninhado dentro de um `ResponsiveModal` (ex: confirmar "Deletar versão" dentro de um seletor) — isso é aceito.

**Empilhando sobre um modal já elevado (`z-[90]`):** o `AlertDialogContent` aceita `overlayClassName` (igual ao `DialogContent`). Quando o AlertDialog abre por cima de um modal que subiu o z-index (ex.: `EconomiaModal` usa `z-[90]`/overlay `z-[85]`), passe `className="z-[95]" overlayClassName="z-[94]"` para o confirm ficar acima — caso contrário o overlay padrão (`z-50`) renderiza atrás do modal de baixo. Ex.: confirmação de **Remover economia** em [EconomiaModal](../../src/components/atualizacao/EconomiaModal.tsx) (substituiu o `window.confirm()` nativo).

---

## Legado — `Dialog` shadcn direto

Os componentes [src/components/ui/dialog.tsx](../../src/components/ui/dialog.tsx) ainda existem e seguem sendo usados internamente pelo `ResponsiveModal` (modo desktop). Para código novo, **importe `ResponsiveModal`**, não `Dialog` direto — assim você ganha o bottom-sheet mobile de graça.

Casos onde `Dialog` direto pode ser usado: nunca, na prática. Tudo migrável para `ResponsiveModal`.

---

## Legado — Custom overlay (não use mais)

Antes da Wave 4, modais complexos eram construídos como `<div className="fixed inset-0 ...">` com handle de Escape, X manual, click-outside manual. **Esse padrão foi removido.** Se você encontrar algum sobrando, migre para `ResponsiveModal`.

Resumo do que o `ResponsiveModal` substitui:
- ❌ `fixed inset-0 z-50 ... bg-black/50` → ✅ wrapper interno
- ❌ `<button onClick={onClose}><X /></button>` no header → ✅ X automático (desktop) / handle drag (mobile)
- ❌ `useEffect` para Escape → ✅ Radix/Vaul cuidam
- ❌ `style={{ maxHeight: "85vh" }}` → ✅ `desktopClassName="!max-h-[85vh]"` ou padrão do wrapper
- ❌ `animate-in zoom-in-95` → ✅ animações automáticas

---

## Drawer lateral (InsumoDetailPanel)

Não usa `<Sheet>` shadcn. Padrão observado:

```tsx
{selected && (
  <>
    <div
      className="fixed inset-0 bg-black/40 z-40"
      onClick={close}
    />
    <DetailPanel data={selected} onClose={close} />
  </>
)}
```

O `DetailPanel` é um componente `fixed right-0` com largura própria. Para drawer novo, siga este padrão ou considere se `<Sheet>` shadcn cabe (já com animação slide-in).

---

## Modal com Tabs internas — hub de domínio

Quando um mesmo objeto de domínio tem **várias visões correlatas** (ex: empreendimento → informações, KPIs, orçamentos, ajustes de aprovação), consolide num único `ResponsiveModal` com `<Tabs>` internas em vez de espalhar em modais separados.

Padrão de referência: [EmpreendimentoModal](../../src/components/empreendimentos/EmpreendimentoModal.tsx).

```tsx
<ResponsiveModal open={!!obra} onOpenChange={(v) => !v && onClose()}>
  <ResponsiveModalContent
    desktopClassName="!max-w-5xl p-0 gap-0 flex flex-col bg-card rounded-2xl !max-h-[90vh]"
  >
    <ResponsiveModalHeader className="px-6 pt-6 pb-3 border-b border-border flex-shrink-0">
      <ResponsiveModalTitle>{obra.id_filial_codigo} — {obra.nome}</ResponsiveModalTitle>
      <ResponsiveModalDescription>{obra.nome_filial}</ResponsiveModalDescription>
    </ResponsiveModalHeader>

    <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 min-h-0">
      <div className="px-6 pt-3 flex-shrink-0">
        <TabsList className="overflow-x-auto max-md:snap-x max-md:snap-mandatory max-w-full">
          <TabsTrigger value="info" className="shrink-0 max-md:snap-start">Informações</TabsTrigger>
          <TabsTrigger value="detalhes" className="shrink-0 max-md:snap-start">Detalhes</TabsTrigger>
          <TabsTrigger value="orcamentos" className="shrink-0 max-md:snap-start">Orçamentos</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent
        value="info"
        className="mt-0 flex-1 overflow-y-auto px-6 py-4 min-h-0 data-[state=inactive]:hidden"
        forceMount
      >
        <InformacoesTab obra={obra} />
      </TabsContent>
      {/* … demais tabs */}
    </Tabs>
  </ResponsiveModalContent>
</ResponsiveModal>
```

Regras:
- **Trigger por tab**: cada gatilho externo (clique no card, botão 📋, ícone ⚙️) pode abrir o **mesmo** modal já posicionado na tab correspondente via prop `initialTab`.
- **Preservar estado entre trocas**: use `forceMount` + `data-[state=inactive]:hidden` no `TabsContent` para que formulários parcialmente preenchidos não percam estado quando o usuário troca de tab.
- **Largura**: `!max-w-5xl` (~1024px) é o sweet-spot para tabs com conteúdo médio. Para tabs com tabela larga (ex: aprovadores + sidebar), considere `!max-w-[1200px]`.
- **Layout interno**: header + tabs ocupam altura fixa; o body de cada `TabsContent` controla seu próprio scroll (`overflow-y-auto flex-1`).
- **Mobile**: `TabsList` precisa de `overflow-x-auto max-md:snap-x max-md:snap-mandatory` para scroll horizontal funcionar bem.
- **Visibilidade condicional de tab**: oculte triggers e content baseado em permissão (`{canSeeAjustes && (...)}`). Não renderize a tab disable — esconda completamente.

Antes de criar este padrão, considere se o conteúdo realmente é parte do **mesmo objeto** — se não, modais separados continuam corretos.

---

## Sheet (shadcn) — disponível mas usado só internamente

[src/components/ui/sheet.tsx](../../src/components/ui/sheet.tsx) existe e é usado via `<Sidebar>` em mobile. Para panels de domínio novos, pese: se for algo simples e lateral, `<Sheet>` já resolve animação + overlay + close X.

## Popover

[src/components/ui/popover.tsx](../../src/components/ui/popover.tsx) — use para menus pequenos ancorados (filtro de coluna, seletor de data). Largura default `w-72` (288px), `p-4`, `rounded-md`. Não é modal.
