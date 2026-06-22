import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

export interface SignatureCanvasHandle {
  toDataURL(): string | null;
  clear(): void;
  isEmpty(): boolean;
}

/**
 * Canvas de assinatura manuscrita. Pointer Events cobrem dedo, caneta e mouse
 * num só código; `touch-action: none` evita scroll durante o traço; o
 * `devicePixelRatio` mantém o traço nítido. Exporta PNG via ref.
 */
export const SignatureCanvas = forwardRef<
  SignatureCanvasHandle,
  { className?: string; onInkChange?: (hasInk: boolean) => void }
>(({ className, onInkChange }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const hasInk = useRef(false);
    const [, force] = useState(0);

    const setupCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(ratio, ratio);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#0f172a';
    }, []);

    useEffect(() => {
      setupCanvas();
      const onResize = () => setupCanvas();
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }, [setupCanvas]);

    function pos(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
      const rect = e.currentTarget.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function start(e: React.PointerEvent<HTMLCanvasElement>) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Captura de ponteiro é melhor-esforço; não deve bloquear o traço.
      }
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;
      drawing.current = true;
      const { x, y } = pos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    }

    function move(e: React.PointerEvent<HTMLCanvasElement>) {
      if (!drawing.current) return;
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;
      const { x, y } = pos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
      if (!hasInk.current) {
        hasInk.current = true;
        onInkChange?.(true);
        force((n) => n + 1);
      }
    }

    function end() {
      drawing.current = false;
    }

    useImperativeHandle(ref, () => ({
      toDataURL: () => (hasInk.current ? (canvasRef.current?.toDataURL('image/png') ?? null) : null),
      isEmpty: () => !hasInk.current,
      clear: () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          hasInk.current = false;
          onInkChange?.(false);
          force((n) => n + 1);
        }
      },
    }));

    return (
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className={className}
        style={{ touchAction: 'none' }}
      />
    );
  },
);
SignatureCanvas.displayName = 'SignatureCanvas';
