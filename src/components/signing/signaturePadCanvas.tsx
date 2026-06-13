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
      const pad = new SignaturePad(canvas, {
        penColor: "#111827",
        minWidth: 1,
        maxWidth: 2.6,
      });
      pad.addEventListener("endStroke", () => onChange?.());
      padRef.current = pad;

      // Re-fit the backing store to the canvas's CSS size and devicePixelRatio whenever it
      // changes (rotating the phone, window resize). Skipping this leaves the backing store at
      // its mount-time width, so signature_pad maps touches to the wrong spot and strokes
      // render offset from the finger. Strokes are preserved across the re-fit.
      let lastW = 0;
      let lastH = 0;
      const fit = () => {
        const c = canvasRef.current;
        if (!c) return;
        const w = c.offsetWidth;
        const h = c.offsetHeight;
        if (w === 0 || h === 0 || (w === lastW && h === lastH)) return;
        const hadSize = lastW !== 0;
        lastW = w;
        lastH = h;
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        const data = pad.toData();
        c.width = w * ratio;
        c.height = h * ratio;
        c.getContext("2d")?.scale(ratio, ratio);
        pad.clear();
        if (data.length > 0) pad.fromData(data);
        if (hadSize) onChange?.();
      };

      fit();
      const observer = new ResizeObserver(() => fit());
      observer.observe(canvas);
      window.addEventListener("resize", fit);

      return () => {
        observer.disconnect();
        window.removeEventListener("resize", fit);
        pad.off();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    React.useImperativeHandle(ref, () => ({
      // toData-based so emptiness stays accurate after a re-fit restores strokes via fromData
      // (signature_pad's internal _isEmpty flag stays true after fromData).
      isEmpty: () => (padRef.current?.toData().length ?? 0) === 0,
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
