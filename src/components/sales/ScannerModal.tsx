import { useEffect, useRef, useState } from "react";
import { X, Camera, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ScannerModalProps {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}

declare global {
  interface Window {
    BarcodeDetector: new (options?: { formats: string[] }) => {
      detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
    };
  }
}

export function ScannerModal({ open, onClose, onDetected }: ScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);

  async function stop() {
    setRunning(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  async function start() {
    setError("");
    if (!open) return;

    if (!("BarcodeDetector" in window)) {
      setError(
        "Seu navegador não suporta scanner automático. Digite o código de barras manualmente."
      );
      return;
    }

    try {
      const constraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();

      const detector = new window.BarcodeDetector({
        formats: ["ean_13", "ean_8", "code_128", "upc_a", "upc_e", "qr_code"],
      });

      setRunning(true);

      const tick = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes?.length) {
            const code = barcodes[0]?.rawValue;
            if (code) {
              onDetected(code);
              await stop();
              onClose();
              return;
            }
          }
        } catch {}
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setError(
        "Não consegui acessar a câmera. Verifique permissões e tente novamente."
      );
    }
  }

  useEffect(() => {
    if (open) start();
    else stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    return () => {
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Scanner de Código de Barras
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Aponte a câmera para o código de barras do produto
          </p>
        </DialogHeader>

        <div className="relative bg-foreground/5">
          <video
            ref={videoRef}
            className="w-full aspect-video object-cover"
            playsInline
            muted
          />
          <div className="absolute inset-4 border-2 border-dashed border-primary/50 rounded-lg pointer-events-none" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2/3 h-0.5 bg-primary/60 animate-pulse-soft" />
          </div>
        </div>

        <div className="p-4 pt-2">
          {error ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              {running ? (
                <>
                  <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  Escaneando...
                </>
              ) : (
                "Preparando câmera..."
              )}
            </div>
          )}

          <Button
            variant="outline"
            className="w-full mt-3"
            onClick={() => {
              stop();
              onClose();
            }}
          >
            <X className="h-4 w-4 mr-2" />
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
