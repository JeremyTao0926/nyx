import { useState, useRef, useEffect, useCallback } from "react";
import { C } from "../utils";

interface Props {
  file: File;
  aspectRatio: number; // 1 for avatar, 2.5 for cover
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
  shape?: "circle" | "rect";
}

export function ImageCropper({ file, aspectRatio, onConfirm, onCancel, shape = "rect" }: Props) {
  const [imgUrl, setImgUrl] = useState("");
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const FRAME_W = 320;
  const FRAME_H = Math.round(FRAME_W / aspectRatio);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function clampOffset(ox: number, oy: number, imgW: number, imgH: number) {
    const scaledW = imgW * scale;
    const scaledH = imgH * scale;
    const maxX = Math.max(0, (scaledW - FRAME_W) / 2);
    const maxY = Math.max(0, (scaledH - FRAME_H) / 2);
    return { x: Math.max(-maxX, Math.min(maxX, ox)), y: Math.max(-maxY, Math.min(maxY, oy)) };
  }

  const onMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    setDragging(true);
    const pt = "touches" in e ? e.touches[0] : e;
    dragStart.current = { x: pt.clientX, y: pt.clientY, ox: offset.x, oy: offset.y };
  };
  const onMouseMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!dragging) return;
    const pt = "touches" in e ? e.touches[0] : e;
    const dx = pt.clientX - dragStart.current.x;
    const dy = pt.clientY - dragStart.current.y;
    const img = imgRef.current;
    if (!img) return;
    const clamped = clampOffset(dragStart.current.ox + dx, dragStart.current.oy + dy, img.naturalWidth, img.naturalHeight);
    setOffset(clamped);
  }, [dragging, scale]);
  const onMouseUp = useCallback(() => setDragging(false), []);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onMouseMove);
    window.addEventListener("touchend", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onMouseMove);
      window.removeEventListener("touchend", onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  async function confirm() {
    const img = imgRef.current;
    if (!img) return;
    const canvas = document.createElement("canvas");
    const OUT_W = aspectRatio === 1 ? 400 : 1200;
    const OUT_H = Math.round(OUT_W / aspectRatio);
    canvas.width = OUT_W; canvas.height = OUT_H;
    const ctx = canvas.getContext("2d")!;
    // Draw scaled + offset image onto canvas
    const scaledW = img.naturalWidth * scale;
    const scaledH = img.naturalHeight * scale;
    const sx = (scaledW - FRAME_W) / 2 - offset.x;
    const sy = (scaledH - FRAME_H) / 2 - offset.y;
    const srcX = (sx / scaledW) * img.naturalWidth;
    const srcY = (sy / scaledH) * img.naturalHeight;
    const srcW = (FRAME_W / scaledW) * img.naturalWidth;
    const srcH = (FRAME_H / scaledH) * img.naturalHeight;
    if (shape === "circle") {
      ctx.save();
      ctx.beginPath();
      ctx.arc(OUT_W / 2, OUT_H / 2, OUT_W / 2, 0, Math.PI * 2);
      ctx.clip();
    }
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, OUT_W, OUT_H);
    if (shape === "circle") ctx.restore();
    canvas.toBlob(blob => { if (blob) onConfirm(blob); }, "image/jpeg", 0.88);
  }

  if (!imgUrl) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.95)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", animation: "fadeIn .2s ease" }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 16 }}>拖動調整位置</div>
      {/* Frame */}
      <div ref={containerRef} style={{ width: FRAME_W, height: FRAME_H, borderRadius: shape === "circle" ? "50%" : 16, overflow: "hidden", border: `2px solid ${C.rose}`, cursor: dragging ? "grabbing" : "grab", position: "relative", flexShrink: 0, boxShadow: `0 0 0 9999px rgba(0,0,0,0.6)` }}
        onMouseDown={onMouseDown} onTouchStart={onMouseDown}>
        <img ref={imgRef} src={imgUrl} alt="" draggable={false}
          style={{ position: "absolute", left: "50%", top: "50%", transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${scale})`, transformOrigin: "center", maxWidth: "none", userSelect: "none", pointerEvents: "none" }}
          onLoad={e => {
            const img = e.currentTarget;
            const sw = FRAME_W / img.naturalWidth;
            const sh = FRAME_H / img.naturalHeight;
            // Start at contain (full image visible) — user can zoom in
            setScale(Math.min(sw, sh));
          }}
        />
      </div>
      {/* Scale slider */}
      <div style={{ marginTop: 16, fontSize: 12, color: "rgba(255,255,255,0.35)", textAlign: "center" as const, marginBottom: 4 }}>拖動移動 · 滑動縮放</div>
  <div style={{ marginTop: 4, width: FRAME_W, display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 12, color: C.textMuted }}>縮小</span>
        <input type="range" min={0.1} max={3} step={0.05} value={scale}
          onChange={e => {
            const s = parseFloat(e.target.value);
            setScale(s);
            const img = imgRef.current;
            if (img) setOffset(o => clampOffset(o.x, o.y, img.naturalWidth, img.naturalHeight));
          }}
          style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: C.textMuted }}>放大</span>
      </div>
      {/* Buttons */}
      <div style={{ display: "flex", gap: 12, marginTop: 24, width: FRAME_W }}>
        <button onClick={onCancel} style={{ flex: 1, padding: "13px", borderRadius: 14, background: "transparent", border: `1px solid ${C.border}`, color: C.textMuted, fontFamily: "inherit", fontSize: 14, cursor: "pointer" }}>取消</button>
        <button onClick={confirm} style={{ flex: 1, padding: "13px", borderRadius: 14, background: C.grad, border: "none", color: "#fff", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 16px ${C.roseGlow}` }}>確認裁剪</button>
      </div>
    </div>
  );
}
