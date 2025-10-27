// utils/size.js

export function getRecommendedSizeFromText(text) {
  if (!text) return null;

  text = text.toLowerCase();

  // Ambil angka dari teks (kg dan cm)
  const weightMatch = text.match(/(\d+)\s*(kg|kilogram)/i);
  const heightMatch = text.match(/(\d+)\s*(cm|centimeter)/i);

  const weight = weightMatch ? parseInt(weightMatch[1]) : null;
  const height = heightMatch ? parseInt(heightMatch[1]) : null;

  // Deteksi bentuk tubuh
  const isCurvy =
    text.includes("buncit") ||
    text.includes("lebar") ||
    text.includes("gendut") ||
    text.includes("berisi") ||
    text.includes("besar");
  const isSlim =
    text.includes("kurus") ||
    text.includes("ramping") ||
    text.includes("langsing") ||
    text.includes("kecil");

  if (!weight && !height) return null;

  return getSizeRecommendation(weight, height, { isCurvy, isSlim });
}

export function getSizeRecommendation(weight, height, { isCurvy = false, isSlim = false } = {}) {
  if (!weight) return null;

  let primarySize = "Standar";
  let secondarySize = "L";

  // Base logic
  if (weight <= 50 && height <= 155) {
    primarySize = "Standar";
    secondarySize = "L";
  } else if (weight <= 58 && height <= 160) {
    primarySize = "L";
    secondarySize = "XL";
  } else if (weight <= 65 && height <= 165) {
    primarySize = "XL";
    secondarySize = "XXL";
  } else if (weight <= 75 && height <= 170) {
    primarySize = "XXL";
    secondarySize = "Jumbo";
  } else {
    primarySize = "Jumbo";
    secondarySize = "Super Jumbo";
  }

  // Body shape adjustments
  if (isCurvy) {
    primarySize = secondarySize;
    if (primarySize === "L") secondarySize = "XL";
    else if (primarySize === "XL") secondarySize = "XXL";
    else if (primarySize === "XXL") secondarySize = "Jumbo";
    else secondarySize = "Super Jumbo";
  } else if (isSlim) {
    if (primarySize === "L") primarySize = "Standar";
    secondarySize = "L";
  }
  
  const message = `Untuk berat ${weight}kg dan tinggi ${height || "-"}cm, ukuran yang kami rekomendasikan adalah **${primarySize}**. Jika Anda menginginkan potongan yang lebih longgar dan nyaman, Anda bisa mempertimbangkan ukuran **${secondarySize}**.`;

  return {
    weight,
    height,
    sizeLabel: primarySize,
    message,
  };
}