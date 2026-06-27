/**
 * Helper to convert a File to a Base64 string for persistent mock storage.
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
}

/**
 * Uploads an image or video file to Cloudinary using an unsigned upload preset.
 * If Cloudinary is not configured or fails, falls back gracefully to a Base64 data URL.
 * Returns the URL of the uploaded/local file.
 */
export async function uploadImage(file) {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  const isConfigValid = cloudName && 
                       uploadPreset && 
                       cloudName !== "YOUR_CLOUD_NAME" && 
                       uploadPreset !== "YOUR_UPLOAD_PRESET" &&
                       !cloudName.includes("placeholder") &&
                       !uploadPreset.includes("placeholder");

  if (!isConfigValid) {
    console.warn("[SmartSamadhan Upload] Cloudinary credentials not configured. Falling back to local Base64 data URL.");
    try {
      return await fileToBase64(file);
    } catch (err) {
      console.error("[SmartSamadhan Upload] Failed to read file as Base64, using object URL instead:", err);
      return URL.createObjectURL(file);
    }
  }

  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
      { method: "POST", body: formData }
    );

    if (!res.ok) {
      throw new Error(`Cloudinary responded with ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    return data.secure_url;
  } catch (err) {
    console.error("[SmartSamadhan Upload] Cloudinary upload failed. Falling back to local Base64 data URL. Error:", err);
    try {
      return await fileToBase64(file);
    } catch (readErr) {
      return URL.createObjectURL(file);
    }
  }
}
