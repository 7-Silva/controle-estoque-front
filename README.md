# Controle de Estoque — Front

Front-end de um sistema de controle de estoque para restaurantes e
confeitarias: login/cadastro de usuários e gestão de ingredientes com
histórico de **entradas** (compras) e **saídas** (uso, venda, perda).

Este projeto foi construído como peça de portfólio, então este README é
propositalmente mais detalhado que o normal: ele documenta não só "como
rodar", mas também **por que** o projeto foi estruturado assim — pensando
em como explicar as decisões numa entrevista técnica.

---

## Sumário

- [Visão geral](#visão-geral)
- [Stack e principais decisões técnicas](#stack-e-principais-decisões-técnicas)
- [Como rodar o projeto](#como-rodar-o-projeto)
- [Rodando com Docker](#rodando-com-docker)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Funcionalidades](#funcionalidades)
- [Como funciona a autenticação](#como-funciona-a-autenticação)
- [Login de demonstração (sem backend)](#login-de-demonstração-sem-backend)
- [Contrato esperado da API](#contrato-esperado-da-api)
- [Decisões de design (UI)](#decisões-de-design-ui)
- [Limitações conhecidas e próximos passos](#limitações-conhecidas-e-próximos-passos)
- [Perguntas que eu me faria numa code review](#perguntas-que-eu-me-faria-numa-code-review)

---

## Visão geral

O sistema tem 3 telas principais, todas protegidas por login:

1. **Estoque atual** — lista de ingredientes com quantidade, estoque
   mínimo, validade, valor da última compra e alertas visuais (vencido,
   vencendo em breve, estoque baixo). Colunas ordenáveis clicando no
   cabeçalho.
2. **Entradas** — histórico de compras. Uma entrada pode ficar
   **pendente** (pedido feito, ainda não chegou) e só soma ao estoque
   quando é marcada como recebida.
3. **Saídas** — histórico de uso/venda/perda. Ao registrar, o sistema
   valida se há estoque suficiente antes de descontar.

O ponto central de design é que **o estoque atual nunca é editado
diretamente pelas telas de Entrada/Saída** — ele é sempre a *consequência*
de registrar uma entrada recebida ou uma saída. Isso modela o problema como
um sistema de movimentações (parecido com um livro-caixa), não como uma
planilha onde qualquer um sobrescreve o número a qualquer momento — o que é
mais próximo de como um controle de estoque real funciona, e é o tipo de
decisão que costuma render uma boa conversa em entrevista.

## Stack e principais decisões técnicas

| Escolha | Por quê |
|---|---|
| **React + Vite** | Vite dá um ambiente de dev rápido (HMR quase instantâneo) e um build de produção mais simples que Create React App (hoje descontinuado). |
| **React Router** | Navegação entre `/login`, `/cadastro` e a área logada, com um componente de rota protegida (`RotaProtegida`) que redireciona quem não está autenticado. |
| **Context API (não Redux)** | O estado global aqui é pequeno — só "quem está logado". Redux (ou Zustand) traria complexidade desnecessária para esse escopo; Context + `useState` já resolve, e é mais fácil de explicar/justificar numa entrevista para um projeto deste tamanho. |
| **Estado local (`useState`) para estoque/entradas/saídas** | Ainda não há backend integrado, então os dados vivem em memória, dentro do componente `Estoque.jsx`. Isso é uma limitação conhecida (ver seção própria) — o objetivo aqui foi deixar a lógica de negócio (cálculo de status, validação de saldo) isolada em funções puras, fáceis de mover para hooks/serviços quando a API entrar. |
| **CSS via variáveis + objetos de estilo inline** | Sem framework de CSS (Tailwind, styled-components). Escolha proposital para manter o projeto simples de ler e explicar linha a linha numa entrevista, sem exigir conhecimento de uma lib extra. As cores/fontes ficam centralizadas em variáveis CSS (`src/index.css`), então trocar o tema inteiro é mexer em um lugar só. |
| **`lucide-react`** | Biblioteca de ícones leve, usada só para clareza visual (status, ações). |
| **Nginx no Docker (não `serve` do Node)** | Em produção, servir arquivos estáticos com Nginx é mais leve e é o padrão de mercado — dá pra falar sobre multi-stage build e por que a imagem final não carrega o Node nem o código-fonte. |

## Como rodar o projeto

```bash
npm install
cp .env.example .env   # ajuste VITE_API_URL se necessário
npm run dev
```

Abra `http://localhost:5173` — você será redirecionado para `/login`.

> O backend ainda não está integrado neste repositório. Enquanto isso, use
> o [login de demonstração](#login-de-demonstração-sem-backend) para
> navegar pelo sistema.

## Rodando com Docker

O projeto tem um `Dockerfile` **multi-stage**: uma etapa instala as
dependências e roda `npm run build`; a segunda etapa serve os arquivos
finais com Nginx (imagem final não tem Node, `node_modules` nem o
código-fonte, só os arquivos estáticos gerados).

```bash
docker compose up --build
```

Abre em `http://localhost:5173`. O `nginx.conf` incluso garante que rotas
como `/login` funcionem mesmo ao recarregar a página diretamente (sem isso,
o Nginx devolveria 404 por não achar um arquivo físico chamado `login`).

Detalhe técnico vale a pena mencionar em entrevista: como `VITE_API_URL` é
uma variável do **Vite**, ela é "compilada" dentro do JavaScript no momento
do `build` — por isso ela é passada como `--build-arg` no Docker, e não
como variável de ambiente de runtime (que só funcionaria se o app lesse
`process.env` no servidor, o que não é o caso de uma SPA estática).

## Estrutura de pastas

```
src/
  api/
    authApi.js         # todas as chamadas HTTP de autenticação (único lugar que fala com o backend)
  context/
    AuthContext.jsx     # estado global de "quem está logado" + token
  components/
    RotaProtegida.jsx   # bloqueia acesso a páginas para quem não está logado
  pages/
    Login.jsx
    Cadastro.jsx
    Estoque.jsx          # as 3 abas: estoque atual, entradas e saídas
  App.jsx                # define as rotas da aplicação
  main.jsx                # ponto de entrada
  index.css               # variáveis de cor/tipografia e estilos globais
```

A escolha de separar `api/` de `context/` é proposital: o Context sabe
*quando* chamar a API (ex: "depois do cadastro, loga automaticamente"),
mas não sabe *como* a requisição é feita por baixo dos panos. Se o formato
da API mudar amanhã, só `authApi.js` muda.

## Funcionalidades

**Estoque atual**
- Alertas automáticos por item: vencido, vencendo em ≤ 3 dias, ou abaixo
  do estoque mínimo (um item pode ter mais de um alerta ao mesmo tempo).
- Busca por nome ou categoria.
- Filtro rápido por tipo de alerta.
- Ordenação clicável em qualquer coluna (nome, quantidade, mínimo, valor
  da última compra, validade, status), com indicador visual de direção.
- Adicionar, editar e excluir ingredientes.

**Entradas**
- Registrar uma compra com quantidade, valor, fornecedor, data da compra
  e data de entrega.
- Se a entrega ainda não aconteceu, a entrada fica **pendente** e não
  altera o estoque atual — só quando for marcada como recebida.
- Excluir uma entrada já recebida desfaz o efeito dela no estoque
  (subtrai de volta), evitando inconsistência.

**Saídas**
- Registrar uso na produção, venda, perda/vencimento ou outro motivo.
- Validação de saldo: não deixa registrar uma saída maior que o estoque
  disponível.
- Excluir uma saída devolve a quantidade ao estoque.

## Como funciona a autenticação

1. No login, o usuário informa **usuário** (não email) e senha.
2. `entrar()` chama `POST /token`, seguindo o padrão **OAuth2** do
   FastAPI: os dados vão como formulário (`username`/`password`), não como
   JSON — isso costuma surpreender quem só trabalhou com APIs REST "puras",
   e é um bom ponto para comentar em entrevista.
3. A resposta traz `access_token` e `refresh_token` (JWT). Com o
   `access_token`, o app busca os dados do usuário em
   `GET /user/{username}/`.
4. No cadastro, `POST /user/` cria a conta mas **não devolve token** — por
   isso, logo após criar a conta, o app chama `entrar()` automaticamente,
   evitando que a pessoa precise digitar a senha de novo.
5. Tudo fica salvo no `localStorage`, para a sessão persistir ao recarregar
   a página. `RotaProtegida` verifica se existe token salvo; se não,
   redireciona para `/login`.

## Login de demonstração (sem backend)

Enquanto o backend não está integrado, dá pra testar o app com um login
que não faz nenhuma chamada de rede:

- **Usuário:** `demo`
- **Senha:** `demo123`

Esse bloco está isolado e comentado em `src/context/AuthContext.jsx`,
dentro da função `entrar()` — procure por `MODO DEMO`. É a primeira coisa
a remover quando o backend estiver de fato integrado.

## Contrato esperado da API

O formato abaixo é baseado num backend de referência em FastAPI (OAuth2 +
JWT). Se o backend final tiver nomes de campos ou rotas diferentes, o
único arquivo que precisa mudar é `src/api/authApi.js`.

### `POST /token` — login
```
Content-Type: application/x-www-form-urlencoded

username=ana&password=123456
```
```json
// 200 OK
{ "access_token": "jwt...", "refresh_token": "jwt...", "token_type": "bearer" }
```
```json
// 401
{ "detail": "Incorrect username or password" }
```

### `POST /user/` — cadastro
```json
// corpo da requisição
{ "username": "ana", "email": "ana@confeitaria.com", "password": "123456" }
```
```json
// 201 Created — não vem token aqui
{ "username": "ana", "avatar": null, "bio": null }
```

### `GET /user/{username}/` — dados do usuário logado
```
Authorization: Bearer {access_token}
```
```json
// 200 OK
{ "username": "ana", "avatar": null, "bio": null }
```

> A tela de Estoque (ingredientes, entradas, saídas) ainda **não está**
> conectada a um backend — os dados vivem em memória, no navegador, e são
> perdidos ao recarregar a página. Ver [próximos passos](#limitações-conhecidas-e-próximos-passos).

## Decisões de design (UI)

- **Paleta escura inspirada em confeitaria/padaria**: tons de café torrado
  e dourado-crosta, em vez do azul/roxo genérico de SaaS. Cores de status
  (vermelho-tijolo, âmbar, verde-sálvia) são distintas da cor de destaque
  da interface, para não confundir "ação" com "alerta".
- **Tipografia combinando serifada + monoespaçada**: títulos em Fraunces
  (serifada, com mais personalidade), texto de interface em IBM Plex Sans,
  e **números/datas em IBM Plex Mono** — isso não é só estético: fontes
  monoespaçadas alinham dígitos verticalmente, o que facilita comparar
  quantidades e valores rapidamente numa tabela.
- **Barra lateral colorida em vez de fundo colorido inteiro**: cada linha
  da tabela tem uma barra de 4px indicando severidade (vermelho/âmbar/
  verde), em vez de pintar a linha inteira — mantém a tabela legível mesmo
  com muitos alertas ativos ao mesmo tempo.

## Limitações conhecidas e próximos passos

Ser transparente sobre isso é parte do que este README quer demonstrar:

- **Sem persistência real**: estoque, entradas e saídas ficam em memória
  React (`useState`). Ao integrar o backend, o ideal é mover essas
  operações para hooks (`useIngredientes`, `useEntradas`, `useSaidas`) que
  encapsulem chamadas HTTP, mantendo os componentes de UI praticamente
  inalterados.
- **Sem renovação automática de token**: o `refresh_token` é salvo mas
  ainda não é usado para renovar o `access_token` quando ele expira.
- **Sem testes automatizados**: um próximo passo natural seria Vitest +
  Testing Library, começando pelas funções puras (`getFlags`,
  `diasParaVencer`, validação de saldo de saída), que não dependem de
  renderização e são fáceis de testar isoladamente.
- **IDs gerados no cliente** (`Date.now()`): funciona para uma
  demonstração, mas um backend real deve ser a fonte da verdade para IDs.

## Perguntas que eu me faria numa code review

Deixo aqui de propósito, como um exercício de autocrítica — são os pontos
que eu mesmo questionaria se estivesse revisando este código de outra
pessoa:

1. *"Por que o estoque, entradas e saídas moram todos dentro de um único
   componente (`Estoque.jsx`)?"* — Porque o escopo ainda é pequeno e as
   três abas compartilham bastante estado (ex: excluir uma entrada precisa
   mexer no array de ingredientes). Se o projeto crescesse, isso seria um
   bom candidato para separar em hooks customizados ou um reducer
   (`useReducer`) para centralizar as transições de estado.
2. *"O que acontece se duas pessoas mexerem no estoque ao mesmo tempo?"*
   — Hoje, nada: é só um navegador, sem sincronização. Com backend real, a
   resposta de cada POST/PATCH deveria vir do servidor e substituir o
   estado local, não só "otimisticamente" assumir que deu certo.
3. *"Por que validar saldo de saída no front, se isso devia ser regra de
   negócio no backend?"* — Validar no front é só para dar feedback
   imediato ao usuário; a validação de verdade (a que garante consistência
   de dados) precisa acontecer no backend também, já que o front nunca
   deve ser a única linha de defesa.
