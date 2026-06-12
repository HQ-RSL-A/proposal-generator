"use client";

import * as React from "react";
import SignaturePad from "signature_pad";
import { Button } from "@/components/ui/button";

export interface SignaturePadHandle {
  isEmpty: () => boolean;
  toPngDataUrl: () => string;
}

export const SignaturePadCanvas = React.forwardRef<SignaturePadHandle, { onChange?: () => void }>(
  function SignaturePadCanvas({ onChange }, ref) {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const padRef = React.useRef<SignaturePad | null>(null);

    React.useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext("2d")?.scale(ratio, ratio);
      const pad = new SignaturePad(canvas, {
        penColor: "#111827",
        minWidth: 1,
        maxWidth: 2.6,
      });
      pad.addEventListener("endStroke", () => onChange?.());
      padRef.current = pad;
      return () => pad.off();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    React.useImperativeHandle(ref, () => ({
      isEmpty: () => padRef.current?.isEmpty() ?? true,
      toPngDataUrl: () => padRef.current?.toDataURL("image/png") ?? "",
    }));

    return (
      <div className="space-y-2">
        <div className="rounded-lg border-2 border-dashed border-border bg-surface">
          <canvas ref={canvasRef} className="h-44 w-full touch-none" />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Draw your signature above</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              padRef.current?.clear();
              onChange?.();
            }}
          >
            Clear
          </Button>
        </div>
      </div>
    );
  }
);
