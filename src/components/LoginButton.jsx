export default function LoginButton({ provider, icon, onClick }) {
    return (
      <button
        onClick={onClick}
        className="w-full p-3 border rounded flex justify-center gap-2 hover:bg-gray-100"
      >
        {icon}
        {provider}
      </button>
    );
  }