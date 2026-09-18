# Roleta da Sorte 🎡

Site em **Vite** para sortear **1 nome** de uma lista, com roleta animada, confete, fogos, som, histórico de ganhadores e **vídeo MP4 do sorteio**.

by **Antony Luiz dev** · [antonyluiz.dev](https://antonyluiz.dev)

## Como rodar

```bash
npm install
npm run dev
```

Abra `http://localhost:5173`. O terminal também mostra um endereço de rede (ex.: `http://192.168.0.10:5173`) — abra esse endereço no celular (mesmo Wi-Fi) para testar a versão mobile.

## Publicar na Vercel

1. Na Vercel: **Add New… → Project** e importe este repositório.
2. A Vercel detecta o Vite sozinha (Build Command `npm run build`, Output Directory `dist`). Não precisa de variáveis de ambiente.
3. Clique em **Deploy**. A cada `git push` na `main` o site é atualizado.

Para testar o build localmente: `npm run build` e depois `npm run preview`. Os caminhos são relativos, então a pasta `dist/` funciona em qualquer hospedagem estática.

## Como funciona

- **Lista de nomes**: um por linha (vírgula e ponto e vírgula também separam). Botões para embaralhar, tirar repetidos, carregar exemplo e limpar (com "Desfazer").
- **Sorteio justo**: o ganhador é escolhido com `crypto.getRandomValues` (sem viés); a animação só leva a roleta até a fatia sorteada.
- **Ganhador**: janela com troféu, raios de luz, nome revelado letra a letra, confete, fogos, clarão, fanfarra e vibração (no celular). Opção de tirar o ganhador da lista.
- **Celular x computador**:
  - Computador (≥ 900 px): lista, roleta e ganhadores lado a lado.
  - Celular (< 900 px): uma tela por vez (`#/nomes`, `#/roleta`, `#/historico`) com barra de abas embaixo. Ao abrir o site, redireciona para a tela certa (roleta se já houver nomes; senão, lista). Tentar sortear sem nomes suficientes redireciona para a lista.
  - Celular deitado: roleta e botões lado a lado.
- **Atalhos**: `Ctrl+Enter` no campo de nomes sorteia; `Espaço` sorteia quando nada está focado; `Esc` fecha a janela do ganhador.
- Lista, opções e histórico ficam salvos no navegador (`localStorage`).
- Respeita "reduzir movimento" do sistema (animações mínimas).

### Vídeo do sorteio (MP4)

Depois do sorteio, na janela do ganhador, escolha o formato:

| Formato | Tamanho | Para |
| --- | --- | --- |
| Vertical | 1080×1920 (9:16) | Reels, Stories, Status, TikTok |
| Quadrado | 1080×1080 (1:1) | Feed, WhatsApp |

- O vídeo mostra **só a roleta girando e o ganhador**, repetindo exatamente o mesmo giro que aconteceu na tela, com som (os "tecs" do ponteiro e a fanfarra), data/hora, quantidade de nomes e o crédito.
- É gerado no próprio navegador, quadro a quadro (WebCodecs + [mediabunny](https://mediabunny.dev)): MP4 H.264 + AAC, ~12 s, 6–11 MB, pronto em poucos segundos. Nada é enviado para servidor.
- No celular aparece o botão **Compartilhar** (WhatsApp, Instagram, salvar na galeria); no computador, **Baixar MP4**.
- Se fechar a janela, o link **Vídeo do último sorteio** (abaixo da roleta) reabre o vídeo. Um novo sorteio descarta o vídeo anterior.
- Funciona no Chrome/Edge (computador e Android) e no Safari 16.4+. Navegadores sem AAC nativo baixam um codificador AAC em WebAssembly (~1 MB), só quando precisam.

## Estrutura

```
index.html              estrutura das telas, janela do ganhador e crédito
public/favicon.svg
src/main.js             liga tudo: lista, sorteio, janela do ganhador, histórico, telas
src/router.js           rotas por hash + detecção celular/computador
src/wheel.js            roleta em canvas (desenho e giro) — também usada pelo vídeo
src/effects.js          confete, partículas de fundo, ripple, avisos
src/sound.js            sons sintetizados (Web Audio) e trilha do vídeo
src/store.js            salvar/carregar, leitura da lista, aleatoriedade
src/video-ui.js         painel "Vídeo do sorteio" (formato, progresso, baixar/compartilhar)
src/video/scene.js      cena do vídeo desenhada quadro a quadro
src/video/confetti.js   confete do vídeo (mesma física do site, determinística)
src/video/export.js     codificação MP4 (H.264 + AAC)
src/styles/             base, layout, componentes, roleta, janela, vídeo
```
