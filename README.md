# Radar de Devoluções

Controle diário das devoluções abertas na Shopee, Mercado Livre e TikTok Shop.
Next.js (App Router) na Vercel + Firestore.

O buraco que ele fecha: a lista de devoluções **esperadas**. Toda devolução aprovada
na plataforma vira uma linha antes de existir caixa nenhuma. A bipagem dá baixa.
O que sobra sem baixa é o que sumiu no caminho de volta.

---

## Como está montado

- **Next.js 15** com App Router. Tudo roda no servidor; o navegador nunca fala com o Firestore.
- **Firestore** acessado só pelo Admin SDK, no servidor. As regras de segurança negam
  qualquer acesso direto do cliente — é isso que mantém os dados fechados.
- **Acesso por link secreto**: uma chave (`APP_KEY`) no endereço, uma vez. O `middleware.ts`
  troca a chave por um cookie httpOnly de 180 dias e limpa a URL. Sem cookie válido,
  qualquer página responde 404 e qualquer rota de API responde 401.
- **Sem login individual.** Não dá para saber quem fez o quê. Se um dia isso passar a
  importar, o caminho é trocar o middleware por Firebase Auth — o resto do código não muda.

### Coleções no Firestore

```
devolucoes/{CANAL__PEDIDO}   uma devolução (o id é derivado do canal + pedido, o que
                             já garante que reimportar o mesmo relatório não duplica)
app/config                   { canais: { "Shopee": {alerta, extravio, contestar}, ... } }
app/mappings                 { maps: { "Shopee": { pedido: "Numero do pedido", ... } } }
```

---

## Passo a passo do zero

### 1. Firebase

1. Acesse `console.firebase.google.com` e clique em **Adicionar projeto**. Nome: `radar-devolucoes`.
   Pode desativar o Google Analytics.
2. No menu lateral, **Criar banco de dados** em **Firestore Database**.
   Escolha **modo de produção** e a região `southamerica-east1` (São Paulo).
3. Ainda no Firestore, aba **Regras**, cole o conteúdo de `firestore.rules` deste projeto
   e publique. Elas negam tudo — o acesso é só pelo servidor, com credencial de administrador.
4. Vá em **Configurações do projeto** (engrenagem) → **Contas de serviço** →
   **Gerar nova chave privada**. Baixa um arquivo `.json`. **Guarde bem: é a senha do banco.**

### 2. Subir para o GitHub

```bash
# dentro da pasta do projeto
git init
git add .
git commit -m "Radar de Devoluções"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/radar-devolucoes.git
git push -u origin main
```

Crie o repositório **privado** em `github.com/new` antes do `git push`.

### 3. Vercel

1. Acesse `vercel.com`, entre com o GitHub e clique em **Add New → Project**.
2. Escolha o repositório `radar-devolucoes`. A Vercel reconhece o Next.js sozinho —
   não mexa em nada na tela de build.
3. Antes de clicar em Deploy, abra **Environment Variables** e crie as duas:

   | Nome | Valor |
   |---|---|
   | `APP_KEY` | uma chave longa e aleatória (veja abaixo) |
   | `FIREBASE_SERVICE_ACCOUNT` | o conteúdo **inteiro** do `.json` da conta de serviço, em uma linha só |

   Para gerar a `APP_KEY`, rode no terminal:
   ```bash
   node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
   ```

   Para o `FIREBASE_SERVICE_ACCOUNT`, abra o `.json` no editor de texto, copie tudo
   (começa com `{` e termina com `}`) e cole. Se a Vercel reclamar das quebras de linha,
   converta para base64 e cole o resultado — o código aceita os dois formatos:
   ```bash
   base64 -w0 minha-chave.json
   ```

4. Clique em **Deploy**.

### 4. Primeiro acesso

Abra uma vez, com a chave no endereço:

```
https://SEU-APP.vercel.app/?k=SUA_APP_KEY
```

O cookie fica gravado por 180 dias. Depois disso o endereço limpo já funciona sozinho.
Mande esse link com a chave para cada pessoa que vai usar, uma vez, e peça para salvar
nos favoritos **o endereço sem a chave**.

**Para revogar o acesso de todo mundo** (funcionária saiu, link vazou): troque a `APP_KEY`
nas variáveis da Vercel e faça um novo deploy. Todos os cookies antigos param de valer
na hora, e você distribui o link novo para quem continua.

---

## Rodar na sua máquina

```bash
npm install
cp .env.example .env.local   # preencha APP_KEY e FIREBASE_SERVICE_ACCOUNT
npm run dev
# abra http://localhost:3000/?k=SUA_APP_KEY
```

Atenção: rodando local você fala com o **mesmo** Firestore da produção. Se quiser separar,
crie um segundo projeto no Firebase só para testes.

---

## Manutenção

- **Exportar tudo:** `/api/export` baixa o CSV completo. Faça isso toda semana.
- **Ajustar prazos por canal:** aba Ajustes, dentro do próprio app.
- **Custo:** com algumas centenas de devoluções por mês, o Firestore fica dentro da
  cota gratuita e a Vercel também. O que consome leitura é a atualização automática
  a cada 30 segundos com a aba aberta — se um dia pesar, aumente o intervalo em
  `src/components/RadarApp.tsx` (a linha do `setInterval`).

## Estrutura

```
src/
  middleware.ts              porta de entrada: link secreto → cookie
  app/
    page.tsx                 carrega os dados no servidor e monta a tela
    layout.tsx, globals.css
    api/
      devolucoes/            GET lista · PATCH [id] atualiza uma
      import/                POST recebe as linhas do CSV, deduplica e grava
      config/                GET/PUT prazos por canal
      mappings/              GET/PUT mapeamento de colunas por canal
      export/                GET CSV completo
  components/
    RadarApp.tsx             estado, abas, bipagem, ações
    Tabela.tsx               tabela, grupos e blocos de número
    Importar.tsx             leitura do CSV e ligação das colunas
    Ajustes.tsx              prazos e backup
    Modais.tsx               conferência, chamado, indenização, detalhes
  lib/
    domain.ts                as regras: dias parados, situação, prazos
    csv.ts                   leitura de CSV e adivinhação das colunas
    firebase-admin.ts        conexão com o Firestore
    types.ts                 tipos e valores padrão
```
