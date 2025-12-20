import { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface CancelModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (motivo: string) => void;
}

export function CancelModal({ open, onClose, onConfirm }: CancelModalProps) {
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    if (open) setMotivo("");
  }, [open]);

  const handleConfirm = () => {
    const m = motivo.trim();
    if (!m) {
      return;
    }
    onConfirm(m);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Cancelar Venda
          </DialogTitle>
          <DialogDescription>
            A venda ficará registrada como CANCELADA. Esta ação não pode ser
            desfeita.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Label htmlFor="motivo">Motivo do cancelamento *</Label>
          <Input
            id="motivo"
            placeholder="Ex: cliente desistiu, erro no valor, produto errado..."
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Voltar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!motivo.trim()}
          >
            Confirmar Cancelamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
