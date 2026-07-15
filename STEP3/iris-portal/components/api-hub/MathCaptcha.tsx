import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function useMathCaptcha() {
  const [seed, setSeed] = useState(0);
  const [a, setA] = useState(0);
  const [b, setB] = useState(0);
  const [answer, setAnswer] = useState("");

  useEffect(() => {
    setA(Math.floor(Math.random() * 8) + 2);
    setB(Math.floor(Math.random() * 8) + 1);
    setAnswer("");
  }, [seed]);

  const isValid = Number(answer) === a + b;
  return {
    node: (
      <div>
        <Label className="mb-2 block text-sm font-semibold">Captcha</Label>
        <div className="flex items-center gap-3">
          <div className="grid h-11 min-w-[110px] flex-1 place-items-center rounded-lg border border-border bg-muted/40 font-mono text-base font-bold tracking-widest text-foreground select-none">
            {a} + {b} = ?
          </div>
          <button type="button" onClick={() => setSeed(s => s + 1)}
            className="grid h-11 w-11 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
            aria-label="Refresh captcha">
            <RefreshCw className="h-4 w-4" />
          </button>
          <Input inputMode="numeric" placeholder="Answer" value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className="h-11 max-w-[120px]" />
        </div>
      </div>
    ),
    isValid,
    reset: () => setSeed(s => s + 1),
  };
}
