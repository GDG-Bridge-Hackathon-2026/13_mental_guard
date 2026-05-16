"use client";

import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useI18nStore } from "@/store/useI18nStore";
import { isRealApiEnabled } from "@/lib/apiConfig";
import { apiMintCallerToken, ApiError, type CallerToken } from "@/lib/apiClient";

interface Props {
  sessionId: string;
  open: boolean;
  onClose: () => void;
}

function buildCallerUrl(sessionId: string, callerToken: string): string {
  if (typeof window === "undefined") return "";
  const explicit = process.env.NEXT_PUBLIC_PUBLIC_URL?.trim();
  const origin =
    explicit && explicit.length > 0 ? explicit : window.location.origin;
  const base = `${origin.replace(/\/$/, "")}/demo/caller/${encodeURIComponent(sessionId)}`;
  return `${base}?ct=${encodeURIComponent(callerToken)}`;
}

export function CallerInviteDialog({ sessionId, open, onClose }: Props) {
  const t = useI18nStore((s) => s.t);
  const [copied, setCopied] = useState(false);
  const [callerToken, setCallerToken] = useState<CallerToken | null>(null);
  const [minting, setMinting] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);

  // Mint a session-scope caller token when the dialog opens (real API only).
  // The QR URL embeds ONLY this short-lived, narrowly-scoped token — never
  // the agent's Firebase ID token.
  useEffect(() => {
    if (!open) {
      setCallerToken(null);
      setMintError(null);
      return;
    }
    if (!isRealApiEnabled()) return;

    let cancelled = false;
    setMinting(true);
    setMintError(null);
    (async () => {
      try {
        const minted = await apiMintCallerToken(sessionId, 1800);
        if (!cancelled) setCallerToken(minted);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          console.warn(
            `[apiClient] mintCallerToken failed (${err.status} ${err.code}): ${err.message}`
          );
          setMintError(`${err.code} (${err.status})`);
        } else {
          setMintError((err as Error).message);
        }
      } finally {
        if (!cancelled) setMinting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, sessionId]);

  const url = useMemo(() => {
    if (!callerToken?.token) return "";
    return buildCallerUrl(sessionId, callerToken.token);
  }, [sessionId, callerToken]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore
    }
  };

  const ttlMinutes = callerToken
    ? Math.max(
        0,
        Math.round(
          (new Date(callerToken.expiresAt).getTime() - Date.now()) / 60000
        )
      )
    : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="surface bg-panel max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="text-[11px] uppercase tracking-wider text-accent mb-2">
          {t.qr.title}
        </div>
        <p className="text-sm text-ink-mute leading-relaxed mb-4">
          {t.qr.body}
        </p>

        <div className="flex justify-center mb-4 min-h-[268px]">
          <div className="bg-white p-3 rounded-2xl border border-line">
            {minting && (
              <div className="w-60 h-60 flex items-center justify-center text-ink-dim text-xs">
                ...
              </div>
            )}
            {!minting && url && (
              <QRCodeSVG
                value={url}
                size={240}
                level="M"
                marginSize={2}
                aria-label="Caller QR code"
              />
            )}
            {!minting && !url && mintError && (
              <div className="w-60 h-60 flex flex-col items-center justify-center text-center text-xs text-ink-dim px-4">
                <p className="text-ink mb-1.5 text-sm font-medium">
                  Caller token unavailable
                </p>
                <p className="leading-relaxed">{mintError}</p>
                <p className="text-[10px] text-ink-dim mt-2">
                  Backend caller-token endpoint may be down. Retry by
                  reopening this dialog.
                </p>
              </div>
            )}
          </div>
        </div>

        {url && (
          <>
            <div className="text-[11px] uppercase tracking-wider text-ink-dim mb-1.5">
              {t.qr.urlLabel}
            </div>
            <div className="flex items-stretch gap-2 mb-2">
              <div className="flex-1 surface-flat px-3 py-2 text-xs text-ink break-all">
                {url}
              </div>
              <button
                type="button"
                onClick={copyUrl}
                className="btn-ghost text-xs whitespace-nowrap"
              >
                {copied ? t.qr.copied : t.qr.copy}
              </button>
            </div>
            <div className="text-[11px] text-ink-dim mb-4">
              Caller token expires in {ttlMinutes} min — scoped to this
              session only.
            </div>
          </>
        )}

        <div className="text-[11px] text-ink-dim mb-4 text-center">
          {t.qr.waitingCaller}
        </div>

        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="btn-primary text-xs">
            {t.qr.close}
          </button>
        </div>
      </div>
    </div>
  );
}
