import baseballImg from "@assets/Baseball_Png_Free_Baseball_Graphics_Image_6_2_1772417357601.png";

export function BaseballIcon({ className }: { className?: string }) {
  return (
    <img src={baseballImg} alt="Baseball" className={className} />
  );
}
