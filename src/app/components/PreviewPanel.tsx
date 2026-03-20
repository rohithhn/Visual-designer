import { useRef, useEffect, useState } from "react";
import { Download } from "lucide-react";
import enkryptLogo from "@/assets/enkrypt-logo.png";
import bg1x1 from "@/assets/bg-1x1.png";
import bg16x9 from "@/assets/placeholder-theme.svg";

interface FontSetting {
  size: number;
  weight: number;
}

interface TextSlotPos {
  yPct: number;
}

interface WordStyle {
  color?: string;
  bold?: boolean;
  strikethrough?: boolean;
  fontSize?: number;
  weight?: number;
  /** Per-word brand gradient (orange → pink) */
  useGradient?: boolean;
}

interface SlotColorSettings {
  baseColor: string;
  useGradient: boolean;
  wordStyles: Record<number, WordStyle>;
}

interface PreviewPanelProps {
  settings: {
    theme: string;
    logoPosition: string;
    padding: number;
    logoScale: number;
    visualImage: string | null;
    size: { width: number; height: number };
    content: { heading: string; subheading: string; footer: string } | null;
    useHeading: boolean;
    useSubheading: boolean;
    useFooter: boolean;
    fontSettings: {
      heading: FontSetting;
      subheading: FontSetting;
      footer: FontSetting;
    };
    visualSlot: { widthPct: number; heightPct: number; yPct: number };
    textSlots: {
      heading: TextSlotPos;
      subheading: TextSlotPos;
      footer: TextSlotPos;
    };
    mode: "general" | "blog";
    textColorSettings?: {
      heading: SlotColorSettings;
      subheading: SlotColorSettings;
      footer: SlotColorSettings;
    };
    variations?: string[];
    activeVariation?: number;
  } | null;
  shouldRender: number;
}

function getBackgroundForSize(w: number, h: number): string {
  return w / h < 1.2 ? bg1x1 : bg16x9;
}

const weightStr = (w: number) => {
  const m: Record<number, string> = { 300: "300", 400: "normal", 500: "500", 600: "600", 700: "bold", 800: "800" };
  return m[w] || `${w}`;
};

const CANVAS_FONT = "Inter, sans-serif";
const DEFAULT_SLOT_GAP = 14;

/** Count wrapped lines and return total pixel height */
function measureWrappedHeight(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: string,
  maxW: number,
  lineHeight: number,
): number {
  if (!text) return 0;
  ctx.save();
  ctx.font = font;
  const words = text.split(" ");
  let line = "";
  let lines = 1;
  for (const word of words) {
    const test = line + word + " ";
    if (ctx.measureText(test).width > maxW && line !== "") {
      lines++;
      line = word + " ";
    } else {
      line = test;
    }
  }
  ctx.restore();
  return lines * lineHeight;
}

export function PreviewPanel({ settings, shouldRender }: PreviewPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasCanvas, setHasCanvas] = useState(false);
  const skipSlotOutlinesRef = useRef(false);
  const pendingExportCallbackRef = useRef<(() => void) | null>(null);
  const [exportTrigger, setExportTrigger] = useState(0);

  const s = settings;
  const currentSize = s?.size ?? { width: 1080, height: 1080 };
  const pad = s?.padding ?? 20;
  const logoPos = s?.logoPosition ?? "top-left";
  const logoScale = s?.logoScale ?? 60;
  const visualImage = s?.visualImage ?? null;
  const content = s?.content ?? null;
  const currentMode = s?.mode ?? "general";
  const useH = s?.useHeading ?? true;
  const useSH = s?.useSubheading ?? true;
  const useF = s?.useFooter ?? true;
  const fs = s?.fontSettings ?? {
    heading: { size: 40, weight: 600 },
    subheading: { size: 27, weight: 600 },
    footer: { size: 24, weight: 400 },
  };
  const vSlot = s?.visualSlot ?? { widthPct: 100, heightPct: 100, yPct: 14 };
  const tSlots = s?.textSlots ?? {
    heading: { yPct: 7 },
    subheading: { yPct: 10 },
    footer: { yPct: 80 },
  };
  const tColors = s?.textColorSettings ?? {
    heading: { baseColor: "#FFFFFF", useGradient: true, wordStyles: {} },
    subheading: { baseColor: "#000000", useGradient: false, wordStyles: {} },
    footer: { baseColor: "#FFFFFF", useGradient: true, wordStyles: {} },
  };
  const slotGap = s?.slotGap ?? DEFAULT_SLOT_GAP;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { width: W, height: H } = currentSize;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    const maxTextW = W - pad * 2;

    // ── Font helpers ──
    const fontOf = (k: "heading" | "subheading" | "footer") =>
      `${weightStr(fs[k].weight)} ${fs[k].size}px ${CANVAS_FONT}`;
    const lhOf = (k: "heading" | "subheading" | "footer") =>
      fs[k].size * 1.35;

    const textOf = (k: "heading" | "subheading" | "footer"): string => {
      if (!content) return "";
      const flags: Record<string, boolean> = { heading: useH, subheading: useSH, footer: useF };
      return flags[k] ? (content[k] ?? "") : "";
    };

    // ── 1. Slot height hugs text: no extra bottom space (last line needs descent only, not full lineHeight) ──
    const ascentOf = (k: "heading" | "subheading" | "footer") => fs[k].size * 0.65;
    const descentOf = (k: "heading" | "subheading" | "footer") => fs[k].size * 0.25;
    const computeSlotH = (k: "heading" | "subheading" | "footer") => {
      const txt = textOf(k);
      const lineH = lhOf(k);
      const rawTextH = txt
        ? measureWrappedHeight(ctx, txt, fontOf(k), maxTextW, lineH)
        : 0;
      const ascent = ascentOf(k);
      const descent = descentOf(k);
      if (rawTextH <= 0) return ascent + lineH; // empty: one line min
      // rawTextH = lines*lineH; slot = ascent + (lines-1)*lineH + descent = ascent + rawTextH - lineH + descent
      return ascent + rawTextH - lineH + descent;
    };

    const headingH = useH ? computeSlotH("heading") : 0;
    const subheadingH = useSH ? computeSlotH("subheading") : 0;
    const footerH = useF ? computeSlotH("footer") : 0;

    // ── 2. Build layout items: only enabled slots + visual ──
    interface LayoutItem {
      id: "heading" | "subheading" | "visual" | "footer";
      desiredY: number;
      h: number;
    }

    const items: LayoutItem[] = [];

    if (currentMode === "blog") {
      // Blog mode: text overlays on top of full-bleed visual
      const logoAreaH = Math.min(W, H) / 12 * (logoScale / 100) + pad + slotGap;
      const isLogoTop = logoPos.startsWith("top");
      const visualTopY = isLogoTop ? logoAreaH : pad;
      const visualBottomLimit = isLogoTop ? H - pad : H - logoAreaH;
      const basicVisualH = visualBottomLimit - visualTopY;
      items.push({ id: "visual", desiredY: visualTopY, h: Math.max(basicVisualH, 100) });
      // Add text slots so advanced settings render overlays
      if (useH) items.push({ id: "heading", desiredY: H * (tSlots.heading.yPct / 100), h: headingH });
      if (useSH) items.push({ id: "subheading", desiredY: H * (tSlots.subheading.yPct / 100), h: subheadingH });
      if (useF) items.push({ id: "footer", desiredY: H * (tSlots.footer.yPct / 100), h: footerH });
    } else {
      // General mode: visual desiredY for sort order only; height will be set dynamically to fill remaining space
      const visualDesiredY = H * ((vSlot.yPct ?? 14) / 100);
      if (useH) items.push({ id: "heading", desiredY: H * (tSlots.heading.yPct / 100), h: headingH });
      if (useSH) items.push({ id: "subheading", desiredY: H * (tSlots.subheading.yPct / 100), h: subheadingH });
      items.push({ id: "visual", desiredY: visualDesiredY, h: 0 });
      if (useF) items.push({ id: "footer", desiredY: H * (tSlots.footer.yPct / 100), h: footerH });
    }

    // Sort by desiredY
    items.sort((a, b) => a.desiredY - b.desiredY);

    // ── 3. Resolve collisions; in general mode visual slot fills remaining space between slots ──
    const resolved: Record<string, { y: number; h: number }> = {};
    let cursor = Math.max(pad * 0.4, 8);
    const minVisualH = 40;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const nextItem = items[i + 1];
      if (currentMode !== "blog" && item.id === "visual") {
        // Visual slot: fill space down to footer (footer is anchored to bottom so no gap below)
        const visualY = cursor;
        const footerTop = useF ? H - pad - footerH : H - pad;
        const nextTop = nextItem && nextItem.id === "footer" ? footerTop : (nextItem ? nextItem.desiredY : H - pad);
        const availableH = nextTop - slotGap - visualY;
        const visualH = Math.max(minVisualH, availableH * ((vSlot.heightPct ?? 100) / 100));
        resolved.visual = { y: visualY, h: visualH };
        cursor = visualY + visualH + slotGap;
      } else if (currentMode !== "blog" && item.id === "footer") {
        // Anchor footer to bottom so there is no empty space below it
        resolved.footer = { y: H - pad - item.h, h: item.h };
        cursor = H - pad - item.h + item.h + slotGap;
      } else {
        const targetY = Math.max(item.desiredY, cursor);
        resolved[item.id] = { y: targetY, h: item.h };
        cursor = targetY + item.h + slotGap;
      }
    }

    // Clamp bottom: push last item up if it overflows (only if not footer, footer is already anchored)
    const lastItem = items[items.length - 1];
    if (lastItem && lastItem.id !== "footer") {
      const lr = resolved[lastItem.id];
      if (lr && lr.y + lr.h > H - 8) {
        lr.y = Math.max(8, H - 8 - lr.h);
      }
    }

    // ── 4. Draw ──
    const bgImg = new Image();
    bgImg.crossOrigin = "anonymous";
    bgImg.onload = () => { ctx.drawImage(bgImg, 0, 0, W, H); afterBg(); };
    bgImg.onerror = () => {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, "#FFF5F0"); g.addColorStop(1, "#FFE9F0");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      afterBg();
    };
    bgImg.src = getBackgroundForSize(W, H);

    function afterBg() {
      if (!skipSlotOutlinesRef.current) {
        drawSlotOutlines();
      }
      drawVisualImage(() => {
        drawLogo(() => {
          drawAllText();
          setHasCanvas(true);
          if (pendingExportCallbackRef.current) {
            pendingExportCallbackRef.current();
            pendingExportCallbackRef.current = null;
            skipSlotOutlinesRef.current = false;
            setExportTrigger((t) => t + 1);
          }
        });
      });
    }

    // ── Slot outlines ──
    function drawSlotOutlines() {
      const textDefs: { id: "heading" | "subheading" | "footer"; colorBase: string; label: string; enabled: boolean }[] = [
        { id: "heading", colorBase: "127,86,217", label: "Heading", enabled: useH },
        { id: "subheading", colorBase: "25,65,133", label: "Subheading", enabled: useSH },
        { id: "footer", colorBase: "240,68,56", label: "Footer", enabled: useF },
      ];

      for (const def of textDefs) {
        if (!def.enabled) continue;
        const r = resolved[def.id];
        if (!r) continue;

        const slotW = maxTextW;
        const slotX = pad;

        ctx.save();
        ctx.setLineDash([8, 6]);
        ctx.strokeStyle = `rgba(${def.colorBase},0.28)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(slotX, r.y, slotW, r.h, 8);
        ctx.stroke();

        ctx.fillStyle = `rgba(${def.colorBase},0.03)`;
        ctx.beginPath();
        ctx.roundRect(slotX, r.y, slotW, r.h, 8);
        ctx.fill();

        // Label tag
        const tagH = 22;
        const tagFontSz = Math.max(13, Math.min(17, W * 0.013));
        ctx.font = `500 ${tagFontSz}px ${CANVAS_FONT}`;
        const tagW = ctx.measureText(def.label).width + 14;
        const tagX = slotX + 6;
        const tagY = r.y + 5;

        ctx.fillStyle = `rgba(${def.colorBase},0.10)`;
        ctx.beginPath();
        ctx.roundRect(tagX, tagY, tagW, tagH, 4);
        ctx.fill();

        ctx.fillStyle = `rgba(${def.colorBase},0.50)`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(def.label, tagX + 7, tagY + tagH / 2);

        ctx.setLineDash([]);
        ctx.restore();
      }

      // Visual slot outline
      const vr = resolved.visual;
      if (!vr) return;
      const vsW = currentMode === "blog" ? (W - pad * 2) : W * (vSlot.widthPct / 100);
      const vsX = currentMode === "blog" ? pad : (W - vsW) / 2;

      ctx.save();
      ctx.setLineDash([10, 7]);
      ctx.strokeStyle = "rgba(155,100,220,0.25)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(vsX, vr.y, vsW, vr.h, 12);
      ctx.stroke();

      ctx.fillStyle = "rgba(155,100,220,0.03)";
      ctx.beginPath();
      ctx.roundRect(vsX, vr.y, vsW, vr.h, 12);
      ctx.fill();

      // Visual label tag
      const vTagH = 22;
      const vTagFontSz = Math.max(13, Math.min(17, W * 0.013));
      ctx.font = `500 ${vTagFontSz}px ${CANVAS_FONT}`;
      const vTagLabel = "Visual";
      const vTagW = ctx.measureText(vTagLabel).width + 14;
      const vTagX = vsX + 6;
      const vTagY = vr.y + 5;
      ctx.fillStyle = "rgba(155,100,220,0.10)";
      ctx.beginPath();
      ctx.roundRect(vTagX, vTagY, vTagW, vTagH, 4);
      ctx.fill();
      ctx.fillStyle = "rgba(155,100,220,0.50)";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(vTagLabel, vTagX + 7, vTagY + vTagH / 2);

      // Empty-state icon
      if (!visualImage) {
        const iconSz = Math.min(vsW, vr.h) * 0.10;
        const cx = vsX + vsW / 2;
        const cy = vr.y + vr.h / 2 - iconSz * 0.15;

        ctx.fillStyle = "rgba(155,100,220,0.12)";
        ctx.beginPath();
        ctx.roundRect(cx - iconSz / 2, cy - iconSz / 2, iconSz, iconSz, iconSz * 0.15);
        ctx.fill();

        ctx.fillStyle = "rgba(155,100,220,0.30)";
        ctx.beginPath();
        const mL = cx - iconSz * 0.3, mR = cx + iconSz * 0.3, mB = cy + iconSz * 0.25;
        ctx.moveTo(mL, mB);
        ctx.lineTo(cx - iconSz * 0.1, cy - iconSz * 0.05);
        ctx.lineTo(cx + iconSz * 0.05, cy + iconSz * 0.1);
        ctx.lineTo(cx + iconSz * 0.15, cy);
        ctx.lineTo(mR, mB);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx + iconSz * 0.15, cy - iconSz * 0.15, iconSz * 0.07, 0, Math.PI * 2);
        ctx.fill();

        const lbl = Math.max(15, Math.min(vsW, vr.h) * 0.045);
        ctx.fillStyle = "rgba(155,100,220,0.25)";
        ctx.font = `500 ${lbl}px ${CANVAS_FONT}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText("Visual Slot", cx, cy + iconSz / 2 + 6);

        const dim = lbl * 0.75;
        ctx.font = `400 ${dim}px ${CANVAS_FONT}`;
        ctx.fillStyle = "rgba(155,100,220,0.18)";
        ctx.fillText(`${vSlot.widthPct}% × ${vSlot.heightPct}%`, cx, cy + iconSz / 2 + 6 + lbl + 3);
      }

      ctx.setLineDash([]);
      ctx.restore();
    }

    // ── Visual image ──
    function drawVisualImage(cb: () => void) {
      if (!visualImage) { cb(); return; }
      const vr = resolved.visual;
      if (!vr) { cb(); return; }
      const vsW = currentMode === "blog" ? (W - pad * 2) : W * (vSlot.widthPct / 100);
      const vsX = currentMode === "blog" ? pad : (W - vsW) / 2;

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        // Contain: fit image inside the slot without zooming or cropping; preserve aspect ratio
        const slotRatio = vsW / vr.h;
        const imgRatio = img.naturalWidth / img.naturalHeight;
        let w: number, h: number;
        if (imgRatio > slotRatio) {
          w = vsW;
          h = vsW / imgRatio;
        } else {
          h = vr.h;
          w = vr.h * imgRatio;
        }
        const drawX = vsX + (vsW - w) / 2;
        const drawY = vr.y + (vr.h - h) / 2;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(vsX, vr.y, vsW, vr.h, 12);
        ctx.clip();
        ctx.drawImage(img, drawX, drawY, w, h);
        ctx.restore();
        cb();
      };
      img.onerror = cb;
      img.src = visualImage;
    }

    // ── Logo ──
    function drawLogo(cb: () => void) {
      const logoImg = new Image();
      logoImg.crossOrigin = "anonymous";
      logoImg.onload = () => {
        const scale = logoScale / 100;
        const baseH = Math.min(W, H) / 12;
        const lH = baseH * scale;
        const lW = (logoImg.naturalWidth / logoImg.naturalHeight) * lH;
        let lX: number, lY: number;
        switch (logoPos) {
          case "top-left": lX = pad; lY = pad; break;
          case "top-center": lX = (W - lW) / 2; lY = pad; break;
          case "top-right": lX = W - pad - lW; lY = pad; break;
          case "bottom-left": lX = pad; lY = H - pad - lH; break;
          case "bottom-center": lX = (W - lW) / 2; lY = H - pad - lH; break;
          case "bottom-right": default: lX = W - pad - lW; lY = H - pad - lH; break;
        }
        ctx.drawImage(logoImg, lX, lY, lW, lH);
        cb();
      };
      logoImg.onerror = cb;
      logoImg.src = enkryptLogo;
    }

    // ── Gradient colors for brand gradient (from CSS --gradient-start / --gradient-end) ──
    const GRADIENT_STOPS = ["#FF7404", "#FF6F53", "#FF3BA2"];

    // ── Text rendering with per-word styling ──
    function drawAllText() {
      if (!content) return;

      const fields: ("heading" | "subheading" | "footer")[] = ["heading", "subheading", "footer"];
      const flags: Record<string, boolean> = { heading: useH, subheading: useSH, footer: useF };

      for (const key of fields) {
        if (!flags[key] || !content[key]) continue;
        const r = resolved[key];
        if (!r) continue;

        const textTopPad = ascentOf(key);
        const textY = r.y + textTopPad;
        const cs = tColors[key];

        drawStyledText(ctx, content[key], W / 2, textY, maxTextW, lhOf(key), fontOf(key), fs[key], cs);
      }
    }

    function drawStyledText(
      ctx: CanvasRenderingContext2D,
      text: string,
      centerX: number,
      startY: number,
      maxW: number,
      lh: number,
      baseFont: string,
      fSetting: { size: number; weight: number },
      cs: SlotColorSettings,
    ) {
      const words = text.split(" ");
      // Build lines with word indices
      interface WordEntry { word: string; globalIdx: number; }
      const lines: WordEntry[][] = [];
      let currentLine: WordEntry[] = [];

      ctx.save();
      ctx.font = baseFont;

      for (let i = 0; i < words.length; i++) {
        const testLine = [...currentLine, { word: words[i], globalIdx: i }];
        const testStr = testLine.map(w => w.word).join(" ");
        if (ctx.measureText(testStr).width > maxW && currentLine.length > 0) {
          lines.push(currentLine);
          currentLine = [{ word: words[i], globalIdx: i }];
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine.length > 0) lines.push(currentLine);

      // Draw each line, word by word
      let cy = startY;
      for (const line of lines) {
        // Measure total line width to center it
        let lineW = 0;
        const wordMetrics: { w: number; entry: WordEntry }[] = [];
        for (let j = 0; j < line.length; j++) {
          const ws = cs.wordStyles[line[j].globalIdx];
          const wordWeight = ws?.weight ?? (ws?.bold ? 700 : fSetting.weight);
          const wordSize = ws?.fontSize ?? fSetting.size;
          ctx.font = `${weightStr(wordWeight)} ${wordSize}px ${CANVAS_FONT}`;
          const suffix = j < line.length - 1 ? " " : "";
          const wm = ctx.measureText(line[j].word + suffix).width;
          wordMetrics.push({ w: wm, entry: line[j] });
          lineW += wm;
        }

        let wx = centerX - lineW / 2;

        for (let j = 0; j < wordMetrics.length; j++) {
          const { w: ww, entry } = wordMetrics[j];
          const ws = cs.wordStyles[entry.globalIdx];
          const wordWeight = ws?.weight ?? (ws?.bold ? 700 : fSetting.weight);
          const wordSize = ws?.fontSize ?? fSetting.size;
          ctx.font = `${weightStr(wordWeight)} ${wordSize}px ${CANVAS_FONT}`;

          // Determine color (per-word brand gradient overrides solid color)
          if (ws?.useGradient) {
            const grad = ctx.createLinearGradient(wx, cy, wx + ww, cy);
            grad.addColorStop(0, GRADIENT_STOPS[0]);
            grad.addColorStop(0.5, GRADIENT_STOPS[1]);
            grad.addColorStop(1, GRADIENT_STOPS[2]);
            ctx.fillStyle = grad;
          } else if (ws?.color) {
            ctx.fillStyle = ws.color;
          } else if (cs.useGradient) {
            const grad = ctx.createLinearGradient(wx, cy, wx + ww, cy);
            const totalWords = words.length;
            const t = totalWords > 1 ? entry.globalIdx / (totalWords - 1) : 0.5;
            // Map t to gradient stops
            if (t <= 0.5) {
              const lt = t / 0.5;
              grad.addColorStop(0, lerpColor(GRADIENT_STOPS[0], GRADIENT_STOPS[1], lt));
              grad.addColorStop(1, lerpColor(GRADIENT_STOPS[0], GRADIENT_STOPS[1], Math.min(1, lt + 0.2)));
            } else {
              const lt = (t - 0.5) / 0.5;
              grad.addColorStop(0, lerpColor(GRADIENT_STOPS[1], GRADIENT_STOPS[2], lt));
              grad.addColorStop(1, lerpColor(GRADIENT_STOPS[1], GRADIENT_STOPS[2], Math.min(1, lt + 0.2)));
            }
            ctx.fillStyle = grad;
          } else {
            ctx.fillStyle = cs.baseColor;
          }

          const suffix = j < wordMetrics.length - 1 ? " " : "";
          ctx.textAlign = "left";
          ctx.textBaseline = "alphabetic";
          ctx.fillText(entry.word + suffix, wx, cy);

          // Strikethrough
          if (ws?.strikethrough) {
            const stY = cy - wordSize * 0.3;
            const textOnlyW = ctx.measureText(entry.word).width;
            ctx.save();
            ctx.strokeStyle = ctx.fillStyle as string;
            ctx.lineWidth = Math.max(2, wordSize * 0.05);
            ctx.beginPath();
            ctx.moveTo(wx, stY);
            ctx.lineTo(wx + textOnlyW, stY);
            ctx.stroke();
            ctx.restore();
          }

          wx += ww;
        }
        cy += lh;
      }
      ctx.restore();
    }

    /** Linearly interpolate between two hex colors */
    function lerpColor(a: string, b: string, t: number): string {
      const pa = hexToRgb(a), pb = hexToRgb(b);
      const r = Math.round(pa.r + (pb.r - pa.r) * t);
      const g = Math.round(pa.g + (pb.g - pa.g) * t);
      const bl = Math.round(pa.b + (pb.b - pa.b) * t);
      return `rgb(${r},${g},${bl})`;
    }

    function hexToRgb(hex: string) {
      const h = hex.replace("#", "");
      return {
        r: parseInt(h.substring(0, 2), 16),
        g: parseInt(h.substring(2, 4), 16),
        b: parseInt(h.substring(4, 6), 16),
      };
    }
  }, [currentSize, pad, logoPos, logoScale, slotGap, visualImage, content, useH, useSH, useF, shouldRender, fs, vSlot, tSlots, currentMode, tColors, exportTrigger]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    skipSlotOutlinesRef.current = true;
    pendingExportCallbackRef.current = () => {
      const link = document.createElement("a");
      link.download = `enkrypt-ai-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    setExportTrigger((t) => t + 1);
  };

  return (
    <div className="bg-card p-6 flex flex-col gap-5" style={{ fontFamily: `'Inter', sans-serif` }}>
      <div
        className="flex-1 bg-muted rounded-[var(--radius-card)] flex items-center justify-center p-8 border-2 border-dashed border-border"
        style={{ minHeight: 500 }}
      >
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full rounded-[var(--radius-card)]"
          style={{ boxShadow: "0 20px 50px rgba(0,0,0,0.15)" }}
        />
      </div>
      {hasCanvas && (
        <button
          onClick={handleDownload}
          className="w-full py-3 px-6 rounded-[var(--radius-button)] border-2 border-primary bg-card text-primary cursor-pointer transition-all hover:bg-primary/5 flex items-center justify-center gap-2"
          style={{ fontWeight: 700, fontSize: "var(--text-base)" }}
        >
          <Download className="w-4 h-4" /> Download PNG
        </button>
      )}
    </div>
  );
}