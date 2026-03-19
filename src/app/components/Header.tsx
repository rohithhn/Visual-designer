import { useState, useRef, useEffect } from "react";
import { Eye, EyeOff, Check, Sun, Moon, Sparkles, BookOpen } from "lucide-react";
import svgPaths from "../../imports/svg-sxifsdxhhb";
import imgAvatar from "@/assets/placeholder-theme.svg";
import enkryptLogo from "@/assets/enkrypt-logo.png";

interface HeaderProps {
  provider: "openai" | "gemini";
  setProvider: (p: "openai" | "gemini") => void;
  apiKeyRaw: string;
  setApiKeyRaw: (k: string) => void;
  mode: "general" | "blog";
  setMode: (m: "general" | "blog") => void;
}

export function Header({ provider, setProvider, apiKeyRaw, setApiKeyRaw, mode, setMode }: HeaderProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const topTab: "general" | "blog" = mode === "blog" ? "blog" : "general";

  /* ── Dark mode ── */
  const [dark, setDark] = useState(() => {
    try {
      const stored = localStorage.getItem("enkrypt-theme");
      if (stored === "dark") return true;
      if (stored === "light") return false;
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    try { localStorage.setItem("enkrypt-theme", dark ? "dark" : "light"); } catch {}
  }, [dark]);

  useEffect(() => {
    if (!settingsOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [settingsOpen]);

  const handleSave = () => {
    try {
      localStorage.setItem("enkrypt-api-provider", provider);
      localStorage.setItem("enkrypt-api-key", apiKeyRaw);
    } catch {}
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const apiConfigured = apiKeyRaw.replace(/[^\x20-\x7E]/g, "").trim().length > 0;

  const handleTopTab = (tab: "general" | "blog") => {
    if (tab === "blog") {
      setMode("blog");
    } else {
      setMode("general");
    }
  };

  return (
    <header className="bg-card border-b border-border">
      {/* Main header row */}
      <div className="flex items-center justify-between px-[32px] h-[64px]">
        {/* ── Left: Logo ── */}
        <div className="flex items-center shrink-0">
          <img
            src={enkryptLogo}
            alt="Enkrypt AI"
            className="h-[32px] object-contain"
          />
        </div>

        {/* ── Center: General / Blog tabs ── */}
        <nav className="flex items-center gap-[4px] bg-muted rounded-[var(--radius)] p-[4px]">
          <button
            onClick={() => handleTopTab("general")}
            className="flex items-center gap-[6px] px-[16px] py-[6px] rounded-[var(--radius-utility)] cursor-pointer transition-all"
            style={{
              border: "none",
              fontSize: "var(--text-sm)",
              fontWeight: topTab === "general" ? 600 : "var(--font-weight-normal)" as any,
              background: topTab === "general" ? "var(--card)" : "transparent",
              color: topTab === "general" ? "var(--foreground)" : "var(--muted-foreground)",
              boxShadow: topTab === "general" ? "var(--elevation-sm)" : "none",
            }}
          >
            <Sparkles className="w-[14px] h-[14px]" />
            General
          </button>
          <button
            onClick={() => handleTopTab("blog")}
            className="flex items-center gap-[6px] px-[16px] py-[6px] rounded-[var(--radius-utility)] cursor-pointer transition-all"
            style={{
              border: "none",
              fontSize: "var(--text-sm)",
              fontWeight: topTab === "blog" ? 600 : "var(--font-weight-normal)" as any,
              background: topTab === "blog" ? "var(--card)" : "transparent",
              color: topTab === "blog" ? "var(--foreground)" : "var(--muted-foreground)",
              boxShadow: topTab === "blog" ? "var(--elevation-sm)" : "none",
            }}
          >
            <BookOpen className="w-[14px] h-[14px]" />
            Blog
          </button>
        </nav>

        {/* ── Right: Actions ── */}
        <div className="flex gap-[2px] items-center">
          {/* API status pill */}
          <div className="flex items-center gap-[6px] px-[10px] py-[4px] mr-[4px] rounded-[9999px] bg-muted">
            <div
              className="w-[6px] h-[6px] rounded-full shrink-0"
              style={{
                background: apiConfigured ? "var(--chart-1)" : "var(--destructive)",
              }}
            />
            <span
              className="text-muted-foreground whitespace-nowrap"
              style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-medium)" as any }}
            >
              {apiConfigured
                ? `${provider === "openai" ? "OpenAI" : "Gemini"}`
                : "No API Key"
              }
            </span>
          </div>

          {/* Dark/Light toggle */}
          <button
            onClick={() => setDark(!dark)}
            className="flex items-center justify-center p-[8px] rounded-[var(--radius-utility)] w-[40px] h-[40px] cursor-pointer hover:bg-muted transition-colors"
            style={{ border: "none", background: "transparent" }}
            title={dark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {dark ? (
              <Sun className="w-[20px] h-[20px] text-muted-foreground" />
            ) : (
              <Moon className="w-[20px] h-[20px] text-muted-foreground" />
            )}
          </button>

          {/* Settings gear (from Figma SVG) */}
          <div className="relative" ref={panelRef}>
            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              className="flex items-center justify-center p-[8px] rounded-[var(--radius-utility)] w-[40px] h-[40px] cursor-pointer hover:bg-muted transition-colors"
              style={{
                border: "none",
                background: settingsOpen ? "var(--muted)" : "transparent",
              }}
              title="API Settings"
            >
              <div className="overflow-clip relative shrink-0 size-[20px]">
                <div className="absolute inset-[8.33%]">
                  <div className="absolute inset-[-5%]">
                    <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18.3333 18.3333">
                      <g>
                        <path d={svgPaths.p32a34900} stroke="var(--muted-foreground)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
                        <path d={svgPaths.p1d320d00} stroke="var(--muted-foreground)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
                      </g>
                    </svg>
                  </div>
                </div>
              </div>
            </button>

            {/* Settings dropdown */}
            {settingsOpen && (
              <div
                className="absolute right-0 top-full mt-2 bg-card border border-border rounded-[var(--radius-card)] overflow-hidden z-50"
                style={{
                  width: 320,
                  boxShadow: "var(--elevation-sm)",
                }}
              >
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted">
                  <div className="overflow-clip relative shrink-0 size-[16px]">
                    <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18.3333 18.3333">
                      <g>
                        <path d={svgPaths.p32a34900} stroke="var(--primary)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
                        <path d={svgPaths.p1d320d00} stroke="var(--primary)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
                      </g>
                    </svg>
                  </div>
                  <span
                    className="text-card-foreground"
                    style={{ fontWeight: 700, fontSize: "var(--text-base)" }}
                  >
                    API Configuration
                  </span>
                </div>

                <div className="p-4 space-y-3">
                  <div>
                    <label
                      className="text-card-foreground block mb-1.5"
                      style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-weight-medium)" as any }}
                    >
                      Provider
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(["openai", "gemini"] as const).map((p) => (
                        <button
                          key={p}
                          onClick={() => setProvider(p)}
                          className="py-2 px-3 rounded-[var(--radius)] border-2 cursor-pointer transition-all"
                          style={{
                            fontSize: "var(--text-sm)",
                            fontWeight: provider === p ? 600 : "var(--font-weight-normal)" as any,
                            background: provider === p ? "var(--primary)" : "var(--card)",
                            color: provider === p ? "var(--primary-foreground)" : "var(--card-foreground)",
                            borderColor: provider === p ? "var(--primary)" : "var(--border)",
                          }}
                        >
                          {p === "openai" ? "OpenAI" : "Gemini"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label
                      className="text-card-foreground block mb-1.5"
                      style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-weight-medium)" as any }}
                    >
                      API Key
                    </label>
                    <div className="relative">
                      <input
                        type={showKey ? "text" : "password"}
                        placeholder={provider === "openai" ? "sk-..." : "AIza..."}
                        value={apiKeyRaw}
                        onChange={(e) => setApiKeyRaw(e.target.value)}
                        className="w-full px-3 py-2 pr-10 rounded-[var(--radius)] border border-border bg-input-background text-foreground"
                        style={{ fontSize: "var(--text-sm)", outline: "none" }}
                      />
                      <button
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center cursor-pointer rounded-[var(--radius-utility)] hover:bg-muted transition-colors"
                        style={{ border: "none", background: "transparent" }}
                        title={showKey ? "Hide" : "Show"}
                      >
                        {showKey
                          ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                          : <Eye className="w-3.5 h-3.5 text-muted-foreground" />}
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleSave}
                    className="w-full py-2 px-3 rounded-[var(--radius-button)] bg-primary text-primary-foreground cursor-pointer transition-all hover:opacity-90 flex items-center justify-center gap-1.5"
                    style={{ fontWeight: 600, fontSize: "var(--text-sm)", border: "none" }}
                  >
                    {saved ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Saved!
                      </>
                    ) : (
                      "Save API Key"
                    )}
                  </button>

                  <div
                    className="bg-warning border border-warning rounded-[var(--radius)] p-2"
                    style={{ fontSize: "var(--text-sm)" }}
                  >
                    <span className="text-warning-foreground">
                      Key is stored locally in your browser only.
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Notification bell (from Figma) */}
          <button
            className="flex items-center justify-center p-[8px] rounded-[var(--radius-utility)] w-[40px] h-[40px] cursor-pointer hover:bg-muted transition-colors"
            style={{ border: "none", background: "transparent" }}
            title="Notifications"
          >
            <div className="overflow-clip relative shrink-0 size-[20px]">
              <div className="absolute inset-[8.33%_13.59%]">
                <div className="absolute inset-[-5%_-5.72%]">
                  <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16.2317 18.3333">
                    <path d={svgPaths.p232d0100} stroke="var(--muted-foreground)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
                  </svg>
                </div>
              </div>
            </div>
          </button>

          {/* Avatar (from Figma) */}
          <button
            className="flex flex-col items-start shrink-0 cursor-pointer"
            style={{ border: "none", background: "transparent" }}
          >
            <div className="pointer-events-none relative rounded-[9999px] shrink-0 size-[40px]">
              <img
                alt="User avatar"
                className="absolute inset-0 max-w-none object-cover rounded-[9999px] size-full"
                src={imgAvatar}
              />
              <div
                aria-hidden="true"
                className="absolute border border-[rgba(0,0,0,0.08)] border-solid inset-0 rounded-[9999px]"
              />
            </div>
          </button>
        </div>
      </div>
    </header>
  );
}