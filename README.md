# Roleta da Sorte 🎡

Site em **Vite** para sortear **1 nome** de uma lista, com roleta animada, confete, fogos, som e histórico de ganhadores.

## Como rodar

```bash
npm install
npm run dev
```

Abra `http://localhost:5173`. O terminal também mostra um endereço de rede (ex.: `http://192.168.0.10:5173`) — abra esse endereço no celular (mesmo Wi-Fi) para testar a versão mobile.

## Publicar

```bash
npm run build
```

Os arquivos finais ficam em `dist/` (caminhos relativos: funciona em qualquer hospedagem estática — Vercel, Netlify, GitHub Pages, etc.). Para conferir o build: `npm run preview`.

## Como funciona

- **Lista de nomes**: um por linha (vírgula e ponto e vírgula também separam). Botões para embaralhar, tirar repetidos, carregar exemplo e limpar (com "Desfazer").
- **Sorteio justo**: o ganhador é escolhido com `crypto.getRandomValues` (sem viés); a animação só leva a roleta até a fatia sorteada.
- **Ganhador**: modal com troféu, raios de luz, nome revelado letra a letra, confete, fogos, clarão, fanfarra e vibração (no celular). Opção de tirar o ganhador da lista.
- **Celular x computador**:
  - Computador (≥ 900 px): lista, roleta e ganhadores lado a lado.
  - Celular (< 900 px): uma tela por vez (`#/nomes`, `#/roleta`, `#/historico`) com barra de abas embaixo. Ao abrir o site, redireciona para a tela certa (roleta se já houver nomes; senão, lista). Tentar sortear sem nomes suficientes redireciona para a lista.
  - Celular deitado: roleta e botões lado a lado.
- **Atalhos**: `Ctrl+Enter` no campo de nomes sorteia; `Espaço` sorteia quando nada está focado; `Esc` fecha o modal.
- Lista, opções e histórico ficam salvos no navegador (`localStorage`).
- Respeita "reduzir movimento" do sistema (animações mínimas).

## Estrutura

```
index.html            estrutura das telas e do modal
public/favicon.svg
src/main.js           liga tudo: lista, sorteio, modal, histórico, telas
src/router.js         rotas por hash + detecção celular/computador
src/wheel.js          roleta em canvas (desenho e giro)
src/effects.js        confete, partículas de fundo, ripple, toasts
src/sound.js          sons sintetizados (Web Audio)
src/store.js          salvar/carregar, leitura da lista, aleatoriedade
src/styles/           base, layout, componentes, roleta, modal
```
