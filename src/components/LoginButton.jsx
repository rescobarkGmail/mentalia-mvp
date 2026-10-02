export default function LoginButton({ provider, icon, onClick }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center justify-center gap-4 rounded-xl border border-cyan-200 bg-white px-5 py-3.5 font-bold text-slate-700 shadow-[0_2px_10px_rgba(24,175,193,0.18)] transition hover:-translate-y-0.5 hover:border-cyan-300 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {icon}
        {provider}
      </button>
    );
  }
