import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const BLOCK_SIZE = 30;

type BlockType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

const TETROMINOS: Record<BlockType, { shape: number[][], color: string }> = {
  I: { shape: [[1, 1, 1, 1]], color: '#9b87f5' },
  O: { shape: [[1, 1], [1, 1]], color: '#0EA5E9' },
  T: { shape: [[0, 1, 0], [1, 1, 1]], color: '#D946EF' },
  S: { shape: [[0, 1, 1], [1, 1, 0]], color: '#F97316' },
  Z: { shape: [[1, 1, 0], [0, 1, 1]], color: '#10B981' },
  J: { shape: [[1, 0, 0], [1, 1, 1]], color: '#F59E0B' },
  L: { shape: [[0, 0, 1], [1, 1, 1]], color: '#EF4444' },
};

interface Position {
  x: number;
  y: number;
}

interface Piece {
  type: BlockType;
  position: Position;
  shape: number[][];
  color: string;
}

const createEmptyBoard = () => 
  Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill(null));

const getRandomPiece = (): Piece => {
  const types: BlockType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
  const type = types[Math.floor(Math.random() * types.length)];
  const tetromino = TETROMINOS[type];
  return {
    type,
    position: { x: Math.floor(BOARD_WIDTH / 2) - 1, y: 0 },
    shape: tetromino.shape,
    color: tetromino.color,
  };
};

const Index = () => {
  const [board, setBoard] = useState(createEmptyBoard());
  const [currentPiece, setCurrentPiece] = useState<Piece | null>(null);
  const [nextPiece, setNextPiece] = useState<Piece>(getRandomPiece());
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [linesCleared, setLinesCleared] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const savedHighScore = localStorage.getItem('tetris-highscore');
    if (savedHighScore) {
      setHighScore(parseInt(savedHighScore, 10));
    }
  }, []);

  const rotatePiece = (piece: Piece): Piece => {
    const newShape = piece.shape[0].map((_, i) =>
      piece.shape.map(row => row[i]).reverse()
    );
    return { ...piece, shape: newShape };
  };

  const checkCollision = useCallback((piece: Piece, newPos: Position): boolean => {
    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x]) {
          const newX = newPos.x + x;
          const newY = newPos.y + y;
          
          if (newX < 0 || newX >= BOARD_WIDTH || newY >= BOARD_HEIGHT) {
            return true;
          }
          
          if (newY >= 0 && board[newY][newX]) {
            return true;
          }
        }
      }
    }
    return false;
  }, [board]);

  const mergePieceToBoard = useCallback((piece: Piece) => {
    const newBoard = board.map(row => [...row]);
    piece.shape.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value) {
          const boardY = piece.position.y + y;
          const boardX = piece.position.x + x;
          if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
            newBoard[boardY][boardX] = piece.color;
          }
        }
      });
    });
    return newBoard;
  }, [board]);

  const clearLines = useCallback((boardToCheck: string[][]) => {
    let linesCleared = 0;
    const newBoard = boardToCheck.filter(row => {
      if (row.every(cell => cell !== null)) {
        linesCleared++;
        return false;
      }
      return true;
    });

    while (newBoard.length < BOARD_HEIGHT) {
      newBoard.unshift(Array(BOARD_WIDTH).fill(null));
    }

    if (linesCleared > 0) {
      const points = [0, 100, 300, 500, 800][linesCleared];
      setScore(prev => prev + points);
      setLinesCleared(prev => {
        const newTotal = prev + linesCleared;
        const newLevel = Math.floor(newTotal / 10) + 1;
        if (newLevel > level) {
          setLevel(newLevel);
          toast({
            title: `🚀 Уровень ${newLevel}!`,
            description: 'Скорость увеличена',
          });
        }
        return newTotal;
      });
      toast({
        title: `${linesCleared} ${linesCleared === 1 ? 'линия' : 'линии'}!`,
        description: `+${points} очков`,
      });
    }

    return newBoard;
  }, [toast]);

  const movePiece = useCallback((direction: 'left' | 'right' | 'down') => {
    if (!currentPiece || gameOver || isPaused) return;

    const offset = direction === 'left' ? { x: -1, y: 0 } : 
                   direction === 'right' ? { x: 1, y: 0 } : 
                   { x: 0, y: 1 };

    const newPos = {
      x: currentPiece.position.x + offset.x,
      y: currentPiece.position.y + offset.y,
    };

    if (!checkCollision(currentPiece, newPos)) {
      setCurrentPiece({ ...currentPiece, position: newPos });
    } else if (direction === 'down') {
      const newBoard = mergePieceToBoard(currentPiece);
      const clearedBoard = clearLines(newBoard);
      setBoard(clearedBoard);
      
      setCurrentPiece(nextPiece);
      setNextPiece(getRandomPiece());
      
      if (checkCollision(nextPiece, nextPiece.position)) {
        setGameOver(true);
        setIsPlaying(false);
        if (score > highScore) {
          setHighScore(score);
          localStorage.setItem('tetris-highscore', score.toString());
          toast({
            title: '🎉 Новый рекорд!',
            description: `${score} очков`,
          });
        }
      }
    }
  }, [currentPiece, gameOver, isPaused, nextPiece, score, highScore, checkCollision, mergePieceToBoard, clearLines, toast]);

  const rotate = useCallback(() => {
    if (!currentPiece || gameOver || isPaused) return;

    const rotated = rotatePiece(currentPiece);
    if (!checkCollision(rotated, rotated.position)) {
      setCurrentPiece(rotated);
    }
  }, [currentPiece, gameOver, isPaused, checkCollision]);

  const hardDrop = useCallback(() => {
    if (!currentPiece || gameOver || isPaused) return;

    let newY = currentPiece.position.y;
    while (!checkCollision(currentPiece, { ...currentPiece.position, y: newY + 1 })) {
      newY++;
    }
    
    const droppedPiece = { ...currentPiece, position: { ...currentPiece.position, y: newY } };
    const newBoard = mergePieceToBoard(droppedPiece);
    const clearedBoard = clearLines(newBoard);
    setBoard(clearedBoard);
    
    setCurrentPiece(nextPiece);
    setNextPiece(getRandomPiece());
    
    if (checkCollision(nextPiece, nextPiece.position)) {
      setGameOver(true);
      setIsPlaying(false);
      if (score > highScore) {
        setHighScore(score);
        localStorage.setItem('tetris-highscore', score.toString());
      }
    }
  }, [currentPiece, gameOver, isPaused, nextPiece, score, highScore, checkCollision, mergePieceToBoard, clearLines]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (gameOver || !isPlaying) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          movePiece('left');
          break;
        case 'ArrowRight':
          e.preventDefault();
          movePiece('right');
          break;
        case 'ArrowDown':
          e.preventDefault();
          movePiece('down');
          break;
        case 'ArrowUp':
          e.preventDefault();
          rotate();
          break;
        case ' ':
          e.preventDefault();
          hardDrop();
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          setIsPaused(prev => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [movePiece, rotate, hardDrop, gameOver, isPlaying]);

  useEffect(() => {
    if (isPlaying && !isPaused && !gameOver) {
      const speed = Math.max(200, 800 - (level - 1) * 60);
      gameLoopRef.current = setInterval(() => {
        movePiece('down');
      }, speed);
    }

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
    };
  }, [isPlaying, isPaused, gameOver, movePiece, level]);

  const startGame = () => {
    setBoard(createEmptyBoard());
    setCurrentPiece(getRandomPiece());
    setNextPiece(getRandomPiece());
    setScore(0);
    setLevel(1);
    setLinesCleared(0);
    setGameOver(false);
    setIsPaused(false);
    setIsPlaying(true);
  };

  const renderBoard = () => {
    const displayBoard = board.map(row => [...row]);
    
    if (currentPiece) {
      currentPiece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value) {
            const boardY = currentPiece.position.y + y;
            const boardX = currentPiece.position.x + x;
            if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
              displayBoard[boardY][boardX] = currentPiece.color;
            }
          }
        });
      });
    }

    return displayBoard.map((row, y) => (
      <div key={y} className="flex">
        {row.map((cell, x) => (
          <div
            key={`${y}-${x}`}
            className="relative"
            style={{
              width: BLOCK_SIZE,
              height: BLOCK_SIZE,
            }}
          >
            <div
              className={`w-full h-full border border-gray-700/30 transition-all duration-200 ${
                cell ? 'animate-fall' : ''
              }`}
              style={{
                backgroundColor: cell || '#1a1f2c',
                boxShadow: cell 
                  ? `0 4px 8px ${cell}40, inset 0 2px 4px rgba(255,255,255,0.2), inset 0 -2px 4px rgba(0,0,0,0.3)`
                  : 'inset 0 0 1px rgba(255,255,255,0.05)',
                transform: cell ? 'translateZ(10px)' : 'translateZ(0)',
              }}
            >
              {cell && (
                <div 
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(135deg, transparent 0%, ${cell}20 50%, transparent 100%)`,
                  }}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    ));
  };

  const renderNextPiece = () => {
    return (
      <div className="flex flex-col items-center gap-2">
        {nextPiece.shape.map((row, y) => (
          <div key={y} className="flex">
            {row.map((cell, x) => (
              <div
                key={`${y}-${x}`}
                className="w-6 h-6"
                style={{
                  backgroundColor: cell ? nextPiece.color : 'transparent',
                  boxShadow: cell 
                    ? `0 2px 4px ${nextPiece.color}40, inset 0 1px 2px rgba(255,255,255,0.2)`
                    : 'none',
                  margin: '1px',
                  borderRadius: '2px',
                }}
              />
            ))}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1f2c] via-[#221F26] to-[#2a1f3d] flex items-center justify-center p-4">
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <Card className="p-6 bg-card/80 backdrop-blur-sm border-border/50">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-primary">ТЕТРИС</h2>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsPaused(!isPaused)}
                  disabled={!isPlaying || gameOver}
                  className="border-primary/30"
                >
                  <Icon name={isPaused ? 'Play' : 'Pause'} size={16} />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex flex-col items-center p-3 bg-background/30 rounded-lg">
                <span className="text-muted-foreground text-xs">Счёт</span>
                <span className="text-2xl font-bold text-primary">{score}</span>
              </div>
              <div className="flex flex-col items-center p-3 bg-background/30 rounded-lg">
                <span className="text-muted-foreground text-xs">Рекорд</span>
                <span className="text-2xl font-bold text-secondary">{highScore}</span>
              </div>
              <div className="flex flex-col items-center p-3 bg-background/30 rounded-lg">
                <span className="text-muted-foreground text-xs">Уровень</span>
                <span className="text-2xl font-bold text-accent">{level}</span>
              </div>
              <div className="flex flex-col items-center p-3 bg-background/30 rounded-lg">
                <span className="text-muted-foreground text-xs">Линии</span>
                <span className="text-2xl font-bold text-foreground">{linesCleared}</span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-card/80 backdrop-blur-sm border-border/50">
          <div 
            className="relative"
            style={{
              perspective: '1000px',
            }}
          >
            <div 
              className="border-4 border-primary/30 rounded-lg overflow-hidden shadow-2xl"
              style={{
                transform: 'rotateX(2deg)',
                boxShadow: '0 20px 60px rgba(155, 135, 245, 0.3)',
              }}
            >
              {renderBoard()}
            </div>

            {gameOver && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center rounded-lg">
                <div className="text-center space-y-4 p-6">
                  <h3 className="text-3xl font-bold text-primary">Игра окончена</h3>
                  <p className="text-xl text-muted-foreground">Счёт: {score}</p>
                  {score > highScore && (
                    <p className="text-lg text-secondary animate-pulse-glow">🏆 Новый рекорд!</p>
                  )}
                  <Button onClick={startGame} className="bg-primary hover:bg-primary/90">
                    Играть снова
                  </Button>
                </div>
              </div>
            )}

            {!isPlaying && !gameOver && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center rounded-lg">
                <div className="text-center space-y-4 p-6">
                  <h3 className="text-3xl font-bold text-primary">ТЕТРИС 3D</h3>
                  <p className="text-muted-foreground">Управление:</p>
                  <div className="text-sm text-left space-y-1 text-muted-foreground">
                    <p>← → - Движение влево/вправо</p>
                    <p>↑ - Поворот блока</p>
                    <p>↓ - Ускорение падения</p>
                    <p>Пробел - Мгновенное падение</p>
                    <p>P - Пауза</p>
                  </div>
                  <Button onClick={startGame} size="lg" className="bg-primary hover:bg-primary/90 mt-4">
                    <Icon name="Play" className="mr-2" size={20} />
                    Начать игру
                  </Button>
                </div>
              </div>
            )}

            {isPaused && isPlaying && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center rounded-lg">
                <div className="text-center space-y-4">
                  <Icon name="Pause" size={48} className="mx-auto text-primary" />
                  <h3 className="text-2xl font-bold text-primary">Пауза</h3>
                  <p className="text-muted-foreground">Нажмите P для продолжения</p>
                </div>
              </div>
            )}
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="p-6 bg-card/80 backdrop-blur-sm border-border/50">
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-primary">Следующая фигура</h3>
              <div className="flex justify-center p-4 bg-background/50 rounded-lg">
                {renderNextPiece()}
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-card/80 backdrop-blur-sm border-border/50">
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-primary">Очки за линии</h3>
              <div className="text-sm space-y-2 text-muted-foreground">
                <div className="flex justify-between">
                  <span>1 линия</span>
                  <span className="text-primary font-semibold">100</span>
                </div>
                <div className="flex justify-between">
                  <span>2 линии</span>
                  <span className="text-primary font-semibold">300</span>
                </div>
                <div className="flex justify-between">
                  <span>3 линии</span>
                  <span className="text-primary font-semibold">500</span>
                </div>
                <div className="flex justify-between">
                  <span>4 линии</span>
                  <span className="text-secondary font-semibold">800</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;