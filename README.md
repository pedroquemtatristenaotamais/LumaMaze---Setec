# ÚLTIMA CHAMA — O LABIRINTO MACABRO

Jogo de exploração e combate em HTML, CSS e JavaScript modular, sem bibliotecas ou serviços externos durante a partida.

## Jogar localmente

Na pasta do projeto, execute:

```bash
npm start
```

Abra **http://localhost:8080**. O servidor local usa apenas os módulos nativos do Node, sem `npm install`. Também funciona com a extensão Live Server do VS Code ou qualquer servidor estático. Não abra pelo protocolo `file://`, pois os módulos JavaScript precisam de HTTP.

## Controles

| Ação | Controle |
| --- | --- |
| Movimentar | WASD ou setas |
| Mirar e atirar | Mouse + botão esquerdo; F atira na direção atual |
| Trocar arma | 1 / 2 / 3, depois de encontrar a arma |
| Recarregar | R |
| Abrir porta / baú / ativar ritual | E |
| Coleção e personalização | I (ou botão COLEÇÃO) |
| Mapa | M |
| Configurações | O |
| Pausar / continuar | Espaço ou Esc |

No celular há controles de movimento, disparo, interação, recarga e mapa, além dos botões de coleção e pausa. Toque no cenário para apontar a arma. O jogo foi pensado principalmente para teclado e mouse.

## Exploração

Os três tamanhos — Catacumbas, Cripta e Abismo — usam geração procedural e crescem ao longo das oito fases. Os mapas contêm regiões inundadas, capelas e jardins de fungos, portas de tesouro com chaves numeradas, armas e recursos. As portas extras protegem anexos opcionais; suas chaves ficam na parte acessível do mapa. A chave antiga continua abrindo a saída.

Há grupos de zumbis errantes, famintos e cuspidores, além de esqueletos, arqueiros, guerreiros, corredores, espectros e incendiários. A quantidade cresce com o mapa e a dificuldade, até 160 inimigos vivos. Os tiros hostis viajam a 20–24 células por segundo, na faixa das armas do jogador: observe a antecipação do ataque e use as paredes como cobertura.

Nas fases 3, 6 e 8, enfrente o Guardião dos Ossos, o Colosso da Peste e o Senhor da Última Cripta. Eles carregam a chave de saída, entram em fúria abaixo de metade da vida e têm padrões próprios; os dois últimos também chamam reforços. Altares opcionais iniciam rituais de três ondas, com equipamentos, recursos e pontos ao concluir. Aproxime-se e pressione E quando quiser começar.

O progresso da campanha é salvo ao concluir uma fase; use “Continuar campanha” na abertura. Repetir uma fase restaura seu checkpoint de campanha, enquanto a coleção e o recorde continuam salvos separadamente.

## Coleção e pontuação

Baús, rituais, bosses e alguns inimigos concedem equipamentos aleatórios. Existem 12 peças em três espaços: cabeça, traje e acessório. Abra **I** para ver o personagem, comparar os bônus e equipar ou retirar peças. A primeira peça descoberta de cada espaço é equipada automaticamente. Os desenhos mudam o capuz, elmo, máscara, traje, proteção e acessórios, usando a paleta original.

As chances base são **60% comum**, **27% raro**, **10% épico** e **3% lendário**. Nomes e uma a quatro estrelas identificam a raridade. Bosses garantem no mínimo raro; o boss final garante épico ou lendário. Repetidos viram 150 pontos. Os bônus combinados têm limites de +20% de dano, 15% de defesa e 10% de redução de recarga; a velocidade do jogador permanece igual.

A coleção, o equipamento selecionado e o recorde ficam neste navegador mesmo após morrer ou iniciar outra campanha. Se o armazenamento estiver bloqueado, o painel informa que a coleção durará apenas a sessão. Apagar os dados do navegador remove esses registros.

Eliminações próximas recebem multiplicador de até ×4, com janela de quatro segundos. Explorar regiões, reunir brasas, encontrar chaves, abrir portas e completar desafios também rende pontos. A pontuação e as chaves aparecem durante a partida, e o resultado é mostrado ao concluir uma fase.

A abertura usa fogo procedural, tochas e brasas em Canvas, sem vídeo. A iluminação do jogo, a animação de água e fungos e os efeitos de combate também são feitos em JavaScript e Canvas 2D.

## Visual e desempenho

Abra os ajustes com **O**:

- **Automática:** ajusta a carga visual conforme o custo da renderização.
- **Alta:** mais luzes e detalhes animados.
- **Leve:** menos luzes, partículas e resolução, mantendo a lógica da partida.
- **Brilho:** ajusta a visibilidade das ruínas.
- **Reduzir movimento:** reduz animações; a preferência do sistema é respeitada na primeira execução.
- **Mostrar FPS:** exibe medição opcional durante a partida.

O desenho estático do labirinto é guardado em blocos limitados em memória. As luzes fixas reutilizam seus cálculos de visibilidade e os inimigos compartilham o cálculo de perseguição. Isso permite mais conteúdo sem recalcular o mesmo cenário e caminho a cada quadro. Ao esconder a abertura, seus efeitos param; a partida pausa ao sair da aba.

FPS depende do navegador, da resolução e do equipamento. Os resultados medidos e o método de comparação ficam em `docs/VERIFICACAO.md`.

## Arquivos

- `index.html`, `style.css`: telas, HUD, controles e ajustes.
- `title-scene.js`: portal, tochas, fogo e brasas da abertura.
- `game.js`: ciclo da partida, combate, coleta, inimigos e progressão.
- `renderer.js`: câmera, cenário em cache, materiais, sombras e efeitos.
- `actor-sprites.js`: personagem armado, equipamentos, zumbis, bosses e animações de morte, compartilhados com a prévia da coleção.
- `progression.js`: raridades, catálogo, bônus, pontuação e persistência da coleção.
- `maze-generator.js`, `pathfinding.js`: geração e navegação.
- `config.js`, `enemy-types.js`: tamanhos, armas e classes de inimigos.
- `audio.js`, `hud.js`, `save-system.js`: áudio procedural, indicadores e persistência local.
- `colegio-logo.png`: identidade do Colégio Estadual Barbosa Ferraz.
- `tools/serve.js`: servidor local de desenvolvimento; não é necessário na hospedagem.

## Verificar

```bash
npm test
```

Os testes usam o executor nativo do Node. A hospedagem continua estática: publique os arquivos do projeto; não há build. Consulte `DEPLOY-VERCEL.txt` se usar Vercel.

Créditos: um jogo de **Pedro**, **2 DS**, Colégio Estadual Barbosa Ferraz.
