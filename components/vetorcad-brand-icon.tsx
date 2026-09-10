import Image from "next/image";

type VetorCadBrandIconProps = {
  size?: number;
  className?: string;
  priority?: boolean;
};

export function VetorCadBrandIcon({ size = 40, className = "", priority = false }: VetorCadBrandIconProps) {
  return (
    <Image
      src="/vetorcad-icon.png"
      alt="Ícone oficial do VetorCAD"
      width={size}
      height={size}
      priority={priority}
      className={`object-contain ${className}`}
    />
  );
}
