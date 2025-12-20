import { useState } from "react";
import { Calendar } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EditDateModalProps {
  open: boolean;
  currentDate: string;
  onClose: () => void;
  onConfirm: (newDate: string) => void;
}

export function EditDateModal({ open, currentDate, onClose, onConfirm }: EditDateModalProps) {
  const formatDateTimeLocal = (dateStr: string) => {
    const date = new Date(dateStr);
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  };

  const [newDate, setNewDate] = useState(() => formatDateTimeLocal(currentDate));

  const handleConfirm = () => {
    const isoDate = new Date(newDate).toISOString();
    onConfirm(isoDate);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Alterar Data da Venda
          </DialogTitle>
          <DialogDescription>
            Selecione a nova data e hora para esta venda.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="currentDate">Data atual</Label>
            <div className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
              {new Date(currentDate).toLocaleString("pt-BR")}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="newDate">Nova data</Label>
            <Input
              id="newDate"
              type="datetime-local"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm}>
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
