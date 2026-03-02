import baseballImg from "@assets/Baseball_Png_Images_Png_1772417427962.png";

export function BaseballIcon({ className }: { className?: string }) {
  return (
    <img src={baseballImg} alt="Baseball" className={className} />
  );
}
