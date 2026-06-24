import { Check } from "lucide-react";
import { STATUS_ORDER, STATUS_META, ContencaoStatus } from "@/lib/contencao";
import { cn } from "@/lib/utils";

interface Props {
  status: ContencaoStatus;
  className?: string;
}

const ContencaoStatusStepper = ({ status, className }: Props) => {
  const currentIndex = STATUS_ORDER.indexOf(status);
  // cancelada → show all gray
  const isCancelled = status === "cancelada";

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center">
        {STATUS_ORDER.map((step, idx) => {
          const meta = STATUS_META[step];
          const reached = !isCancelled && idx <= currentIndex;
          const isCurrent = !isCancelled && idx === currentIndex;
          return (
            <div key={step} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1 min-w-0">
                <div
                  className={cn(
                    "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[11px] sm:text-xs font-semibold border-2 transition-colors shrink-0",
                    reached
                      ? `${meta.dot} text-white border-transparent`
                      : "bg-muted text-muted-foreground border-border",
                    isCurrent && meta.pulse && "animate-pulse",
                  )}
                >
                  {reached && idx < currentIndex ? (
                    <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  ) : (
                    idx + 1
                  )}
                </div>
                <span
                  className={cn(
                    "text-[9px] sm:text-xs font-medium text-center leading-tight max-w-[56px] sm:max-w-none break-words",
                    reached ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {meta.label}
                </span>
              </div>
              {idx < STATUS_ORDER.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-1 sm:mx-2 mb-5 transition-colors",
                    idx < currentIndex
                      ? meta.dot
                      : "bg-border",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
      {isCancelled && (
        <div className="mt-2 text-center text-xs font-medium text-red-600">
          Cancelada
        </div>
      )}
    </div>
  );
};

export default ContencaoStatusStepper;
