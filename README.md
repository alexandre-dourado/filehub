# 📁 FileHub — Central de Conhecimento Pessoal

Hub de arquivos 100% estático para GitHub Pages. Organize arquivos locais em categorias, visualize-os com preview interno, busque em tempo real e salve favoritos.

---

## 🗂️ Estrutura do Projeto

```
hub/
├── content/              ← Coloque seus arquivos aqui
│   ├── categoria1/       ← Subpastas viram categorias automaticamente
│   ├── categoria2/
│   └── arquivo-solto.md
│
├── data/
│   └── index.json        ← Gerado automaticamente pelo script
│
├── scripts/
│   └── generate-index.js ← Indexador Node.js
│
├── icons/                ← Ícones do PWA
├── index.html            ← Frontend do hub
├── app.js                ← Lógica da aplicação
├── styles.css            ← Estilos dark
├── manifest.json         ← Configuração PWA
└── service-worker.js     ← Cache offline
```

---

## 🚀 Primeiros Passos

### 1. Pré-requisito

- **Node.js** v14 ou superior instalado
- Conta no GitHub com GitHub Pages habilitado

### 2. Clonar / Criar o repositório

```bash
# Clonar este projeto
git clone https://github.com/SEU_USUARIO/filehub.git
cd filehub
```

### 3. Adicionar seus arquivos

Copie seus arquivos para `/content`. Use subpastas para organizar por categoria:

```
content/
├── tutoriais/
│   ├── git-basico.md
│   └── linux-comandos.txt
├── referencias/
│   ├── cheatsheet.html
│   └── manual.pdf
└── notas-gerais.txt
```

### 4. Gerar o índice

```bash
node scripts/generate-index.js
```

Saída esperada:
```
📂 Varrendo /content…
✅ index.json gerado com 5 arquivo(s) → data/index.json
```

### 5. Testar localmente

Você precisa de um servidor HTTP local (não funciona abrindo o HTML diretamente no navegador por causa do CORS):

```bash
# Com Python (já vem instalado no macOS/Linux)
python3 -m http.server 8080

# Com Node.js
npx serve .

# Com VS Code
# Instale a extensão "Live Server" e clique em "Go Live"
```

Acesse: `http://localhost:8080`

### 6. Deploy no GitHub Pages

```bash
# Adicionar todos os arquivos
git add .

# Commit
git commit -m "feat: adicionar arquivos e atualizar índice"

# Push para o branch principal
git push origin main
```

Em seguida, nas configurações do repositório:
- **Settings → Pages → Source → Deploy from branch**
- Selecione: `main` / `/(root)`
- Salvar

Seu hub estará em: `https://SEU_USUARIO.github.io/filehub`

---

## 🔄 Fluxo de uso diário

```
1. Arraste arquivos para /content (ou subpastas)
2. Execute: node scripts/generate-index.js
3. git add . && git commit -m "update" && git push
4. Aguarde ~1 min e o site estará atualizado ✅
```

---

## 🎛️ Funcionalidades

| Recurso | Descrição |
|---------|-----------|
| 🔍 Busca em tempo real | Filtra por nome, ao digitar |
| 🗂️ Filtro por categoria | Clique na sidebar para filtrar |
| 📅 Ordenação | Por data (mais/menos recente) ou nome |
| ▦ Grid / Lista | Alterne o modo de visualização |
| 👁️ Preview interno | HTML, PDF, MD, TXT sem sair da página |
| ⭐ Favoritos | Persistência local (localStorage) |
| 📋 Copiar conteúdo | Para arquivos .txt e .md |
| 📲 PWA | Instalável como app no celular/desktop |
| 🌐 Offline | Service Worker com cache básico |
| ⌨️ Atalho | Tecle `/` para focar na busca |

---

## 📄 Tipos de arquivo suportados

| Tipo | Preview |
|------|---------|
| `.md` | Renderizado com marked.js |
| `.html` | Iframe seguro |
| `.txt` | Texto + botão copiar |
| `.pdf` | Iframe nativo |
| `.png` `.jpg` `.gif` `.svg` | Imagem inline |
| Outros | Link para abrir em nova aba |

---

## ⚙️ Personalização

### Adicionar novos tipos de arquivo

Em `scripts/generate-index.js`, adicione a extensão no array:

```js
const ALLOWED_EXTENSIONS = [
  '.html', '.md', '.txt', '.pdf',
  '.docx', '.xlsx',   // ← adicione aqui
];
```

### Mudar cor de acento

Em `styles.css`, altere:

```css
:root {
  --accent:    #7c3aed;  /* ← troque pela cor desejada */
  --accent-lt: #9d5cf7;
}
```

### GitHub Actions (automação total)

Crie `.github/workflows/index.yml` para gerar o índice automaticamente ao fazer push:

```yaml
name: Gerar Índice

on:
  push:
    paths:
      - 'content/**'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: node scripts/generate-index.js
      - run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add data/index.json
          git commit -m "chore: atualizar index.json [skip ci]" || echo "Sem mudanças"
          git push
```

---

## ⚠️ Limitações (GitHub Pages)

- **Sem upload pela interface** — adicione arquivos manualmente e faça push
- **Sem backend** — tudo funciona como site estático
- **Arquivos grandes** — GitHub Pages tem limite de 100MB por arquivo e 1GB por repositório
- **CORS** — ao testar localmente, use um servidor HTTP (não abra o HTML direto)

---

## 📜 Licença

MIT — use, modifique e distribua à vontade.
