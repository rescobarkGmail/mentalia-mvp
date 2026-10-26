import logoFluyeProMentalia from "../images/Logo_FluyePro_Mentalia.jpg";

export default function BrainLogo() {
  return (
    <div className="flex flex-col items-center">
      <img
        src={logoFluyeProMentalia}
        alt="FluyePro Mentalia"
        className="h-44 w-44 rounded-2xl object-contain shadow-[0_0_28px_rgba(15,118,130,0.2)]"
      />
    </div>
  );
}
