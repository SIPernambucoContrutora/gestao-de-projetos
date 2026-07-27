# Gestão das Obras

Painel para acompanhamento de projetos técnicos de empreendimentos (obras) —
disciplinas, etapas, prazos, desvios e histórico de alterações.

Implementado a partir do protótipo de design `Gestao de Projetos.dc.html`
(claude.ai/design), reproduzido fielmente em React e transformado em um
aplicativo real que funciona **100% offline**.

## Como usar

Abra **`index.html`** no navegador (duplo clique). Não precisa de servidor,
internet nem instalação — o React fica embutido na pasta `vendor/`.

> As fontes IBM Plex vêm do Google Fonts quando há internet; sem conexão, o
> navegador usa uma fonte equivalente do sistema. Nada mais depende da rede.

Na tela de login, clique em **Entrar** (é um acesso simbólico do protótipo —
ainda não há autenticação real com servidor).

## Telas

- **Dashboard** — visão consolidada de todos os itens, com métricas (total,
  finalizados, em andamento, atrasados), filtros por empreendimento,
  disciplina, etapa e status, e busca.
- **Empreendimentos** — cartões com progresso de cada obra.
- **Quadro de itens** — tabela detalhada de um empreendimento; clique numa
  linha para abrir o item.
- **Histórico** — auditoria de todos os campos editados nos itens.
- **Usuários** — equipe e papéis (Admin / Equipe / Leitura).
- **Painel do item** (drawer) — editar status, etapa, datas e observações.
  Ao salvar, as mudanças são registradas no histórico automaticamente.

O status visual (verde / âmbar / vermelho / cinza) e o **desvio** de prazo são
calculados a partir das datas (previsto, reprogramado, realizado), tomando
**27/07/2026** como data de referência — igual ao design original.

## Persistência

As edições feitas nos itens (e o histórico gerado) são salvas no
`localStorage` do navegador, então **sobrevivem a recarregar a página**. É um
acréscimo em relação ao protótipo, que reiniciava a cada carregamento.

Para voltar aos dados originais (seed), limpe o armazenamento do site no
navegador (ou apague a chave `gestao-obras-v1`).

## Estrutura

```
index.html   Casca da página: estilos base + carrega vendor/ e app.js
src/app.jsx  Código-fonte da aplicação (React, com JSX) — edite aqui
app.js       app.jsx compilado para JS puro (gerado — não editar à mão)
vendor/      React e ReactDOM (produção) embutidos para uso offline
build.mjs    Compila src/app.jsx -> app.js
package.json  Scripts e dependência de build
```

## Editar e recompilar

O código é escrito em `src/app.jsx`. Depois de alterar, recompile para `app.js`:

```bash
npm install     # baixa @babel/standalone (só na primeira vez)
npm run build   # gera app.js a partir de src/app.jsx
```

`index.html` sempre carrega o `app.js` compilado — abra-o novamente para ver o
resultado.

## Próximos passos sugeridos

Este app guarda os dados no próprio navegador. Para uso por várias pessoas com
dados compartilhados, o passo natural é ligar a um backend (banco de dados +
API) e substituir o login simbólico por autenticação real.
