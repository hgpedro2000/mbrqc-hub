import { useState, useRef, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Circle, Square, ArrowUp, Crop, Undo2, Check, X } from "lucide-react";

type Tool = "arrow" | "circle" | "rectangle" | "crop" | null;

interface Props {
  open: boolean;
  imageFile: File | null;
  onConfirm: (annotatedFile: File) => void;
  onCancel: () => void;
}

interface Shape {
  tool: "arrow" | "circle" | "rectangle";
  x1: number; y1: number; x2: number; y2: number;
  color: string;
}

const COLOR_OPTIONS: { value: string; label: string; ring: string }[] = [
  { value: "#FF0000", label: "Vermelho", ring: "ring-red-500" },
  { value: "#FACC15", label: "Amarelo", ring: "ring-yellow-400" },
  { value: "#FFFFFF", label: "Branco", ring: "ring-white" },
];
const LINE_WIDTH = 3;

const ImageAnnotationEditor = ({ open, imageFile, onConfirm, onCancel }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<Tool>(null);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const [cropRect, setCropRect] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [cropping, setCropping] = useState(false);
  const [color, setColor] = useState<string>(COLOR_OPTIONS[0].value);

  // Load image when file changes
  useEffect(() => {
    if (!imageFile || !open) return;
    const img = new Image();
    const url = URL.createObjectURL(imageFile);
    img.onload = () => {
      setImgEl(img);
      URL.revokeObjectURL(url);
    };
    img.src = url;
    setShapes([]);
    setTool(null);
    setCropRect(null);
    setCropping(false);
  }, [imageFile, open]);

  // Resize canvas to fit container
  useEffect(() => {
    if (!imgEl || !containerRef.current) return;
    const container = containerRef.current;
    const maxW = container.clientWidth;
    const maxH = window.innerHeight * 0.55;
    let w = imgEl.width;
    let h = imgEl.height;
    const ratio = Math.min(maxW / w, maxH / h, 1);
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
    setCanvasSize({ w, h });
  }, [imgEl]);

  // Redraw
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgEl) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);

    const drawShape = (s: Shape) => {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = LINE_WIDTH;
      ctx.fillStyle = "transparent";

      if (s.tool === "rectangle") {
        ctx.strokeRect(s.x1, s.y1, s.x2 - s.x1, s.y2 - s.y1);
      } else if (s.tool === "circle") {
        const cx = (s.x1 + s.x2) / 2;
        const cy = (s.y1 + s.y2) / 2;
        const rx = Math.abs(s.x2 - s.x1) / 2;
        const ry = Math.abs(s.y2 - s.y1) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (s.tool === "arrow") {
        const dx = s.x2 - s.x1;
        const dy = s.y2 - s.y1;
        const angle = Math.atan2(dy, dx);
        const headLen = 15;
        ctx.beginPath();
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(s.x2, s.y2);
        ctx.lineTo(s.x2 - headLen * Math.cos(angle - Math.PI / 6), s.y2 - headLen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(s.x2, s.y2);
        ctx.lineTo(s.x2 - headLen * Math.cos(angle + Math.PI / 6), s.y2 - headLen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      }
    };

    shapes.forEach(drawShape);

    // Draw current shape being drawn
    if (drawing && tool && tool !== "crop") {
      drawShape({ tool, x1: startPos.x, y1: startPos.y, x2: currentPos.x, y2: currentPos.y, color });
    }

    // Draw crop overlay
    if (tool === "crop" && cropping) {
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const cx1 = Math.min(startPos.x, currentPos.x);
      const cy1 = Math.min(startPos.y, currentPos.y);
      const cw = Math.abs(currentPos.x - startPos.x);
      const ch = Math.abs(currentPos.y - startPos.y);
      ctx.clearRect(cx1, cy1, cw, ch);
      ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);
      shapes.forEach(drawShape);
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      // Draw overlay around crop area
      ctx.fillRect(0, 0, canvas.width, cy1);
      ctx.fillRect(0, cy1, cx1, ch);
      ctx.fillRect(cx1 + cw, cy1, canvas.width - cx1 - cw, ch);
      ctx.fillRect(0, cy1 + ch, canvas.width, canvas.height - cy1 - ch);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(cx1, cy1, cw, ch);
      ctx.setLineDash([]);
    }

    if (cropRect) {
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const cx1 = Math.min(cropRect.x1, cropRect.x2);
      const cy1 = Math.min(cropRect.y1, cropRect.y2);
      const cw = Math.abs(cropRect.x2 - cropRect.x1);
      const ch = Math.abs(cropRect.y2 - cropRect.y1);
      ctx.clearRect(cx1, cy1, cw, ch);
      ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);
      shapes.forEach(drawShape);
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(0, 0, canvas.width, cy1);
      ctx.fillRect(0, cy1, cx1, ch);
      ctx.fillRect(cx1 + cw, cy1, canvas.width - cx1 - cw, ch);
      ctx.fillRect(0, cy1 + ch, canvas.width, canvas.height - cy1 - ch);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(cx1, cy1, cw, ch);
      ctx.setLineDash([]);
    }
  }, [imgEl, shapes, drawing, tool, startPos, currentPos, cropping, cropRect]);

  useEffect(() => { redraw(); }, [redraw, canvasSize]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0]?.clientX ?? e.changedTouches[0]?.clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0]?.clientY ?? e.changedTouches[0]?.clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!tool) return;
    e.preventDefault();
    const pos = getPos(e);
    setStartPos(pos);
    setCurrentPos(pos);
    setDrawing(true);
    if (tool === "crop") setCropping(true);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing) return;
    e.preventDefault();
    setCurrentPos(getPos(e));
  };

  const handleEnd = () => {
    if (!drawing || !tool) return;
    setDrawing(false);

    if (tool === "crop") {
      setCropping(false);
      setCropRect({ x1: startPos.x, y1: startPos.y, x2: currentPos.x, y2: currentPos.y });
      setTool(null);
    } else {
      const dx = Math.abs(currentPos.x - startPos.x);
      const dy = Math.abs(currentPos.y - startPos.y);
      if (dx > 5 || dy > 5) {
        setShapes((prev) => [...prev, { tool, x1: startPos.x, y1: startPos.y, x2: currentPos.x, y2: currentPos.y, color }]);
      }
    }
  };

  const handleUndo = () => {
    if (cropRect) {
      setCropRect(null);
    } else {
      setShapes((prev) => prev.slice(0, -1));
    }
  };

  const handleConfirm = () => {
    if (!canvasRef.current || !imgEl) return;

    // Create a full-resolution canvas
    const fullCanvas = document.createElement("canvas");
    const scaleX = imgEl.width / canvasSize.w;
    const scaleY = imgEl.height / canvasSize.h;

    if (cropRect) {
      const cx1 = Math.min(cropRect.x1, cropRect.x2) * scaleX;
      const cy1 = Math.min(cropRect.y1, cropRect.y2) * scaleY;
      const cw = Math.abs(cropRect.x2 - cropRect.x1) * scaleX;
      const ch = Math.abs(cropRect.y2 - cropRect.y1) * scaleY;
      fullCanvas.width = cw;
      fullCanvas.height = ch;
      const ctx = fullCanvas.getContext("2d")!;
      ctx.drawImage(imgEl, cx1, cy1, cw, ch, 0, 0, cw, ch);
      // Draw shapes that fall within crop area
      drawShapesOnCtx(ctx, shapes, scaleX, scaleY, cx1, cy1);
    } else {
      fullCanvas.width = imgEl.width;
      fullCanvas.height = imgEl.height;
      const ctx = fullCanvas.getContext("2d")!;
      ctx.drawImage(imgEl, 0, 0);
      drawShapesOnCtx(ctx, shapes, scaleX, scaleY, 0, 0);
    }

    fullCanvas.toBlob(
      (blob) => {
        if (!blob || !imageFile) return;
        const file = new File([blob], imageFile.name, { type: "image/jpeg", lastModified: Date.now() });
        onConfirm(file);
      },
      "image/jpeg",
      0.92
    );
  };

  const drawShapesOnCtx = (ctx: CanvasRenderingContext2D, shapes: Shape[], sx: number, sy: number, ox: number, oy: number) => {
    ctx.lineWidth = LINE_WIDTH * sx;
    shapes.forEach((s) => {
      ctx.strokeStyle = s.color;
      const x1 = s.x1 * sx - ox, y1 = s.y1 * sy - oy;
      const x2 = s.x2 * sx - ox, y2 = s.y2 * sy - oy;
      if (s.tool === "rectangle") {
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      } else if (s.tool === "circle") {
        const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
        const rx = Math.abs(x2 - x1) / 2, ry = Math.abs(y2 - y1) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (s.tool === "arrow") {
        const dx = x2 - x1, dy = y2 - y1;
        const angle = Math.atan2(dy, dx);
        const headLen = 15 * sx;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      }
    });
  };

  const tools: { id: Tool; label: string; icon: any }[] = [
    { id: "arrow", label: "Seta", icon: ArrowUp },
    { id: "circle", label: "Círculo", icon: Circle },
    { id: "rectangle", label: "Retângulo", icon: Square },
    { id: "crop", label: "Recorte", icon: Crop },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-[95vw] sm:max-w-xl md:max-w-2xl p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-sm sm:text-base">Anotar Imagem</DialogTitle>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex items-center gap-1 flex-wrap">
          {tools.map((t) => (
            <Button
              key={t.id}
              variant={tool === t.id ? "default" : "outline"}
              size="sm"
              className="gap-1 h-8 text-xs px-2"
              onClick={() => setTool(tool === t.id ? null : t.id)}
            >
              <t.icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.label}</span>
            </Button>
          ))}
          <div className="flex-1" />
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={handleUndo} disabled={shapes.length === 0 && !cropRect}>
            <Undo2 className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Canvas */}
        <div ref={containerRef} className="flex justify-center overflow-hidden bg-muted/30 rounded-md">
          <canvas
            ref={canvasRef}
            width={canvasSize.w}
            height={canvasSize.h}
            className="touch-none cursor-crosshair max-w-full"
            style={{ width: canvasSize.w, height: canvasSize.h }}
            onMouseDown={handleStart}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={handleStart}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
          />
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} className="gap-1">
            <X className="w-3.5 h-3.5" /> Cancelar
          </Button>
          <Button size="sm" onClick={handleConfirm} className="gap-1">
            <Check className="w-3.5 h-3.5" /> Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImageAnnotationEditor;
