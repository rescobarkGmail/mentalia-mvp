import { Brain } from "lucide-react";

export default function BrainLogo() {
  return (
    <div className="flex flex-col items-center">
      <div className="grid h-24 w-24 place-items-center rounded-full bg-cyan-50 text-[#18AFC1] shadow-[0_0_28px_rgba(24,175,193,0.28)]">
        <Brain size={58} strokeWidth={1.8} />
      </div>
      <h1 className="mt-4 text-center text-4xl font-black tracking-tight text-[#18AFC1] drop-shadow-[0_0_12px_rgba(24,175,193,0.35)]">
        Mental-IA
      </h1>
    </div>
  );
}
