import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { AlertCircle, Camera, Flashlight, FlashlightOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface CameraScannerProps {
  open: boolean;
  onClose: () => void;
  /** Chamado a cada leitura. Em modo contínuo o scanner continua aberto. */
  onDetected: (code: string) => void;
  continuous?: boolean;
  /** Conteúdo exibido abaixo do vídeo (ex.: último item lido). */
  footer?: React.ReactNode;
  title?: string;
}

const FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
];

/** Mesmo código lido de novo dentro deste intervalo é ignorado (câmera parada sobre o item). */
const REPEAT_MS = 1500;

export function CameraScanner({
  open,
  onClose,
  onDetected,
  continuous = false,
  footer,
  title = "Escanear com câmera",
}: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const onDetectedRef = useRef(onDetected);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  onDetectedRef.current = onDetected;

  const stop = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setRunning(false);
    setTorchOn(false);
    setTorchAvailable(false);
  }, []);

  useEffect(() => {
    if (!open) {
      stop();
      return;
    }
    let cancelled = false;
    setError("");

    async function start() {
      // O Dialog monta o <video> no próximo frame
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const video = videoRef.current;
      if (!video || cancelled) return;

      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Este navegador não permite acesso à câmera. Use o leitor ou digite o código.");
        return;
      }

      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, FORMATS);
      hints.set(DecodeHintType.TRY_HARDER, true);
      const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 80 });

      try {
        const controls = await reader.decodeFromConstraints(
          {
            audio: false,
            video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          },
          video,
          (result) => {
            if (!result) return;
            const code = result.getText().trim();
            const now = Date.now();
            if (!code) return;
            if (code === lastRef.current.code && now - lastRef.current.at < REPEAT_MS) {
              lastRef.current.at = now;
              return;
            }
            lastRef.current = { code, at: now };
            onDetectedRef.current(code);
            if (!continuous) {
              stop();
              onClose();
            }
          }
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setRunning(true);

        const track = (video.srcObject as MediaStream | null)?.getVideoTracks()[0];
        const caps = track?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
        setTorchAvailable(Boolean(caps?.torch || controls.switchTorch));
      } catch {
        setError("Não foi possível acessar a câmera. Verifique a permissão do navegador e tente novamente.");
      }
    }

    start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [open, continuous, onClose, stop]);

  async function toggleTorch() {
    const next = !torchOn;
    try {
      if (controlsRef.current?.switchTorch) {
        await controlsRef.current.switchTorch(next);
      } else {
        const track = (videoRef.current?.srcObject as MediaStream | null)?.getVideoTracks()[0];
        await track?.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      }
      setTorchOn(next);
    } catch {
      setTorchAvailable(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden gap-0 max-h-[100dvh] sm:max-h-[90vh] flex flex-col">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">EAN-13, EAN-8, UPC e Code128. Aponte para o código de barras.</p>
        </DialogHeader>

        <div className="relative bg-black">
          <video ref={videoRef} className="w-full aspect-[4/3] sm:aspect-video object-cover" playsInline muted />
          <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-1/3 border-2 border-primary/70 rounded-lg pointer-events-none" />
          {torchAvailable && (
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="absolute right-3 top-3 h-12 w-12 rounded-full"
              onClick={toggleTorch}
              aria-label={torchOn ? "Desligar lanterna" : "Ligar lanterna"}
            >
              {torchOn ? <FlashlightOff className="h-5 w-5" /> : <Flashlight className="h-5 w-5" />}
            </Button>
          )}
        </div>

        <div className="p-4 space-y-3 overflow-auto">
          {error ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              {running ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  {continuous ? "Lendo continuamente..." : "Escaneando..."}
                </>
              ) : (
                "Preparando câmera..."
              )}
            </div>
          )}

          {footer}

          <Button variant="outline" className="w-full h-12 text-base" onClick={onClose}>
            <X className="h-5 w-5 mr-2" />
            Fechar câmera
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
