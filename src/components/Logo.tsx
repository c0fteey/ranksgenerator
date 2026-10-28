import Image from "next/image";

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <Image
      src="/logo.png"
      alt=""
      width={size}
      height={size}
      preload
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  );
}
