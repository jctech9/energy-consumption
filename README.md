# Consumo de energia

Sistema web estatico baseado na planilha `consumo de energia.xlsx`, pronto para GitHub Pages com Cloud Firestore como banco Firebase.

## Logica aplicada

- Tarifa padrao: `R$ 0,83/kWh`, extraida da aba `24h-Ligados`.
- Dias padrao do mes: `24`, seguindo a formula da planilha `(kWh * tarifa) * 24`.
- Para aparelhos 24h ligados ou por horas/dia, o sistema normaliza o consumo medido para `kWh/h` e projeta para o mes.
- Para itens `por uso`, o custo mensal usa `kWh medido * tarifa * usos no mes`.
- Para `periodo medido`, o custo fica no periodo informado, sem normalizar para 24h.

## Banco Firebase

O sistema grava no Cloud Firestore no documento:

```text
energyConsumption/default
```

Esse documento guarda:

- `records`: aparelhos e medicoes.
- `settings`: tarifa padrao e dias padrao.
- `updatedAt`: ultima gravacao.

Preencha `public/firebase-config.js` com as credenciais do app web criado no console do Firebase:

```js
window.firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

Ative tambem:

- Firestore Database.
- Authentication > Sign-in method > Anonymous.

As regras em `firestore.rules` permitem leitura e gravacao apenas para usuarios autenticados anonimamente pelo app.

## Rodar localmente

```powershell
node dev-server.js
```

Depois acesse `http://127.0.0.1:5173/`.

## Hospedar no GitHub Pages

Este repositorio tem um workflow em `.github/workflows/pages.yml` que publica a pasta `public`.

No GitHub:

1. Abra `Settings > Pages`.
2. Em `Build and deployment`, selecione `GitHub Actions`.
3. Envie os arquivos para a branch `main` ou `master`.
4. Aguarde o workflow `Deploy GitHub Pages`.

Depois, no console do Firebase, adicione o dominio do GitHub Pages em:

```text
Authentication > Settings > Authorized domains
```

Exemplo:

```text
seu-usuario.github.io
```

Se o site ficar em `https://seu-usuario.github.io/energy-consumption/`, adicione apenas `seu-usuario.github.io`.

## Deploy das regras do Firebase

```powershell
firebase login
firebase use --add
firebase deploy --only firestore
```

O arquivo `firebase.json` continua disponivel para publicar as regras do Firestore. O hosting principal fica no GitHub Pages.
