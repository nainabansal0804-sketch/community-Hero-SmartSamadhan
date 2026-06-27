export async function analyzeIssue(file, lat, lng) {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("lat", lat.toString());
  formData.append("lng", lng.toString());

  const res = await fetch(
    "/analyze-issue",
    { method: "POST", body: formData }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Analysis failed");
  }

  return res.json();
}